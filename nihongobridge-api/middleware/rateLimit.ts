import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import { ensureRedisConnection, getRedisClient } from "@/middleware/cache";

const WINDOW_SECONDS = 60;
const ANONYMOUS_LIMIT = 100;
const AUTHENTICATED_LIMIT = 1_000;
const MAX_LOCAL_IDENTITIES = 10_000;

interface LocalWindow {
  count: number;
  resetAt: number;
}

const localWindows = new Map<string, LocalWindow>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Must come from already-verified authentication middleware, never raw client input. */
  authenticatedUserId?: string;
}

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function identityKey(request: NextRequest, options: RateLimitOptions): string {
  const raw = options.authenticatedUserId
    ? `user:${options.authenticatedUserId}`
    : `ip:${requestIp(request)}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function localRateLimit(key: string, limit: number, now: number): RateLimitResult {
  let window = localWindows.get(key);
  if (!window || window.resetAt <= now) {
    const windowMilliseconds = WINDOW_SECONDS * 1_000;
    window = {
      count: 0,
      resetAt: (Math.floor(now / windowMilliseconds) + 1) * windowMilliseconds,
    };
  }
  window.count += 1;
  localWindows.set(key, window);

  if (localWindows.size > MAX_LOCAL_IDENTITIES) {
    for (const [candidate, value] of localWindows) {
      if (value.resetAt <= now || localWindows.size > MAX_LOCAL_IDENTITIES) {
        localWindows.delete(candidate);
      }
      if (localWindows.size <= MAX_LOCAL_IDENTITIES) break;
    }
  }

  const remaining = Math.max(0, limit - window.count);
  const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1_000));
  return {
    allowed: window.count <= limit,
    limit,
    remaining,
    resetAt: window.resetAt,
    retryAfter,
  };
}

export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const now = Date.now();
  const limit = options.authenticatedUserId ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT;
  const identity = identityKey(request, options);
  const windowMilliseconds = WINDOW_SECONDS * 1_000;
  const windowNumber = Math.floor(now / windowMilliseconds);
  const windowEnd = (windowNumber + 1) * windowMilliseconds;
  const windowTtl = Math.max(1, Math.ceil((windowEnd - now) / 1_000));
  const redisKey = `${process.env.CACHE_NAMESPACE ?? "nihongobridge"}:rate:${identity}:${windowNumber}`;
  const client = getRedisClient();

  if (client) {
    try {
      await ensureRedisConnection(client);
      const result = (await client.eval(
        RATE_LIMIT_SCRIPT,
        1,
        redisKey,
        windowTtl,
      )) as [number, number];
      const count = Number(result[0]);
      const ttl = Math.max(1, Number(result[1]));
      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt: now + ttl * 1_000,
        retryAfter: ttl,
      };
    } catch {
      if (process.env.RATE_LIMIT_FAIL_OPEN === "false") {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAt: now + WINDOW_SECONDS * 1_000,
          retryAfter: WINDOW_SECONDS,
        };
      }
    }
  }

  return localRateLimit(identity, limit, now);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfter) }),
  };
}

export function clearLocalRateLimits(): void {
  localWindows.clear();
}
