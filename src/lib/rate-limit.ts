import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

type LimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

function keyPart(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}

/** Extract the first trusted proxy address; Vercel supplies x-forwarded-for. */
export function requestIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")?.trim()
    || "unknown";
}

/**
 * Fixed-window limiter backed by Upstash. It deliberately fails closed: public
 * write endpoints should not become unprotected when the limiter is unavailable.
 */
export async function checkRateLimit({ scope, identifier, limit, windowSeconds }: LimitOptions): Promise<RateLimitResult> {
  const key = `kazi:rate:${scope}:${keyPart(identifier)}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return { allowed: count <= limit, retryAfterSeconds: windowSeconds };
  } catch (error) {
    console.error("Rate limiter unavailable", error);
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "Cache-Control": "no-store",
  };
}
