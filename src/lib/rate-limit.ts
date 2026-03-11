/**
 * In-memory rate limiter.
 *
 * ⚠️  IMPORTANT — PRODUCTION LIMITATION:
 * This store is in process memory. On Vercel, each serverless function instance
 * has its own memory, so rate limits are per-instance and reset on cold starts /
 * deploys. This is acceptable for low-traffic / single-instance use.
 *
 * For multi-instance production (Vercel with concurrent functions), replace the
 * Map with an Upstash Redis store:
 *   https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 *
 * Drop-in replacement: `import { Ratelimit } from "@upstash/ratelimit"`
 */

type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

// Purge expired entries every 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
