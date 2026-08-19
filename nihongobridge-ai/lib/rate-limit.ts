import { createHash } from "node:crypto";

import Redis from "ioredis";

import type { AuthenticatedUser } from "@/lib/auth";

const FREE_LIMIT = 20;
const WINDOW_SECONDS = 60 * 60;
const MAX_LOCAL_USERS = 10_000;

interface LocalWindow {
  count: number;
  resetAt: number;
}

export interface TutorQuota {
  allowed: boolean;
  limit: number | "unlimited";
  remaining: number | "unlimited";
  resetAt: number;
  retryAfter: number;
}

const localWindows = new Map<string, LocalWindow>();
let redis: Redis | null | undefined;

const RATE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

function redisClient(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    redis = null;
    return null;
  }
  redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
  });
  redis.on("error", () => undefined);
  return redis;
}

function identity(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

function fixedWindow(now: number): { number: number; end: number; ttl: number } {
  const milliseconds = WINDOW_SECONDS * 1_000;
  const number = Math.floor(now / milliseconds);
  const end = (number + 1) * milliseconds;
  return { number, end, ttl: Math.max(1, Math.ceil((end - now) / 1_000)) };
}

function localQuota(key: string, now: number): TutorQuota {
  const window = fixedWindow(now);
  let item = localWindows.get(key);
  if (!item || item.resetAt <= now) item = { count: 0, resetAt: window.end };
  item.count += 1;
  localWindows.set(key, item);

  if (localWindows.size > MAX_LOCAL_USERS) {
    for (const [candidate, candidateWindow] of localWindows) {
      if (candidateWindow.resetAt <= now || localWindows.size > MAX_LOCAL_USERS) {
        localWindows.delete(candidate);
      }
      if (localWindows.size <= MAX_LOCAL_USERS) break;
    }
  }

  return {
    allowed: item.count <= FREE_LIMIT,
    limit: FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - item.count),
    resetAt: item.resetAt,
    retryAfter: Math.max(1, Math.ceil((item.resetAt - now) / 1_000)),
  };
}

export async function consumeTutorQuota(
  user: AuthenticatedUser,
  now = Date.now(),
): Promise<TutorQuota> {
  if (user.tier === "premium") {
    return {
      allowed: true,
      limit: "unlimited",
      remaining: "unlimited",
      resetAt: now,
      retryAfter: 0,
    };
  }

  const key = identity(user.id);
  const window = fixedWindow(now);
  const client = redisClient();
  if (client) {
    try {
      if (client.status === "wait") await client.connect();
      const namespace = process.env.RATE_LIMIT_NAMESPACE ?? "nihongobridge:ai";
      const result = (await client.eval(
        RATE_SCRIPT,
        1,
        `${namespace}:tutor:${key}:${window.number}`,
        window.ttl,
      )) as [number, number];
      const count = Number(result[0]);
      const ttl = Math.max(1, Number(result[1]));
      return {
        allowed: count <= FREE_LIMIT,
        limit: FREE_LIMIT,
        remaining: Math.max(0, FREE_LIMIT - count),
        resetAt: now + ttl * 1_000,
        retryAfter: ttl,
      };
    } catch {
      if (process.env.NODE_ENV === "production" && process.env.RATE_LIMIT_FAIL_OPEN !== "true") {
        return {
          allowed: false,
          limit: FREE_LIMIT,
          remaining: 0,
          resetAt: now + 60_000,
          retryAfter: 60,
        };
      }
    }
  } else if (
    process.env.NODE_ENV === "production" &&
    process.env.RATE_LIMIT_FAIL_OPEN !== "true"
  ) {
    return {
      allowed: false,
      limit: FREE_LIMIT,
      remaining: 0,
      resetAt: now + 60_000,
      retryAfter: 60,
    };
  }

  return localQuota(key, now);
}

export function quotaHeaders(quota: TutorQuota): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(quota.limit),
    "X-RateLimit-Remaining": String(quota.remaining),
    "X-RateLimit-Reset": String(Math.ceil(quota.resetAt / 1_000)),
    ...(quota.allowed ? {} : { "Retry-After": String(quota.retryAfter) }),
  };
}

export async function resetRateLimitState(): Promise<void> {
  localWindows.clear();
  if (redis) await redis.quit().catch(() => undefined);
  redis = undefined;
}
