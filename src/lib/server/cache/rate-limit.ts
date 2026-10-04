import "server-only";

import { RateLimitError } from "@/lib/server/domain/errors";

import { getKvStore } from "./kv";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limit backed by the shared KV store. Buckets are namespaced
 * by route + identifier (e.g. client IP or lead id).
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${bucket}:${identifier}`;
  const count = await getKvStore().incr(key, windowSeconds);
  const remaining = Math.max(0, limit - count);
  return {
    allowed: count <= limit,
    limit,
    remaining,
    retryAfterSeconds: windowSeconds,
  };
}

export function rateLimitIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "anonymous";
}

/** Throwing wrapper used by route handlers: raises a 429 AppError when exceeded. */
export async function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const result = await rateLimit(
    bucket,
    rateLimitIdentifier(request),
    limit,
    windowSeconds,
  );
  if (!result.allowed) {
    throw new RateLimitError(
      `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
    );
  }
}
