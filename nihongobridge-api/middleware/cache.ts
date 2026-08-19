import { createHash } from "node:crypto";

import Redis from "ioredis";

export type CacheStatus = "HIT" | "MISS";

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_MEMORY_ENTRIES = 1_000;

const globalRedis = globalThis as typeof globalThis & {
  __nihongoBridgeRedis?: Redis;
};

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!globalRedis.__nihongoBridgeRedis) {
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      retryStrategy: () => null,
    });
    client.on("error", (error) => {
      console.warn("Redis cache unavailable:", error.message);
    });
    globalRedis.__nihongoBridgeRedis = client;
  }
  return globalRedis.__nihongoBridgeRedis;
}

export async function ensureRedisConnection(client: Redis): Promise<void> {
  if (client.status === "wait") await client.connect();
  if (client.status !== "ready") throw new Error(`Redis is ${client.status}`);
}

function getMemory<T>(key: string): T | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  // Refresh insertion order to provide a small LRU cache in local development.
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.value as T;
}

function setMemory<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
}

export function cacheKey(prefix: string, parameters: unknown): string {
  const namespace = process.env.CACHE_NAMESPACE ?? "nihongobridge";
  const digest = createHash("sha256")
    .update(JSON.stringify(parameters))
    .digest("hex")
    .slice(0, 32);
  return `${namespace}:${prefix}:${digest}`;
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<{ value: T; status: CacheStatus }> {
  const client = getRedisClient();
  if (client) {
    try {
      await ensureRedisConnection(client);
      const cached = await client.get(key);
      if (cached !== null) {
        return { value: JSON.parse(cached) as T, status: "HIT" };
      }
    } catch {
      // The bounded in-memory fallback preserves local availability.
    }
  }

  const memoryValue = getMemory<T>(key);
  if (memoryValue !== undefined) return { value: memoryValue, status: "HIT" };

  const existing = inflight.get(key);
  if (existing) {
    return { value: (await existing) as T, status: "HIT" };
  }

  const promise = loader();
  inflight.set(key, promise);
  try {
    const value = await promise;
    if (shouldCache(value)) {
      setMemory(key, value, ttlSeconds);
      if (client) {
        try {
          await ensureRedisConnection(client);
          await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
        } catch {
          // Memory fallback is already populated.
        }
      }
    }
    return { value, status: "MISS" };
  } finally {
    inflight.delete(key);
  }
}

export function clearMemoryCache(): void {
  memoryCache.clear();
  inflight.clear();
}
