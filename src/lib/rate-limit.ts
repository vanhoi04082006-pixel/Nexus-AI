/**
 * rate-limit.ts — Simple in-memory rate limiter (token bucket per key).
 *
 * No Redis needed — suitable for single-instance deployments.
 * For multi-instance, replace with Upstash Redis or similar.
 *
 * Usage:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   if (!rateLimit(`fix-mermaid:${access.email}`, 5, 60_000)) {
 *     return Response.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

type Bucket = { count: number; resetAt: number };

// Store on globalThis to survive dev hot-reloads
const gc = globalThis as typeof globalThis & { rateLimitBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = gc.rateLimitBuckets ?? new Map<string, Bucket>();
gc.rateLimitBuckets = buckets;

// Cleanup expired buckets every 5 minutes to prevent unbounded growth
let lastCleanup = Date.now();
function cleanupExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return; // 5 min
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Check if a request is allowed under the rate limit.
 * @param key Unique identifier (e.g., `fix-mermaid:user@example.com`)
 * @param maxRequests Maximum requests per window
 * @param windowMs Window duration in milliseconds
 * @returns true if allowed, false if rate-limited
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  cleanupExpired();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    // New window
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false; // rate-limited
  }

  bucket.count++;
  return true;
}

/**
 * Get rate limit headers for response.
 * @param key Bucket key
 * @param maxRequests Max per window
 * @param windowMs Window in ms
 */
export function rateLimitHeaders(key: string, maxRequests: number, windowMs: number): {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
} {
  const bucket = buckets.get(key);
  const now = Date.now();
  const resetAt = bucket?.resetAt ?? (now + windowMs);
  const remaining = Math.max(0, maxRequests - (bucket?.count ?? 0));
  return {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
