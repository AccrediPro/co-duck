/**
 * @fileoverview In-Memory Rate Limiting
 *
 * Provides per-key sliding window rate limiting for API routes.
 * Uses in-memory storage — works for single-instance deployments.
 * For multi-instance, swap to @upstash/ratelimit with Redis.
 *
 * ## Usage
 * ```ts
 * import { rateLimit, RateLimitConfig } from '@/lib/rate-limit';
 *
 * const limiter: RateLimitConfig = { limit: 10, windowMs: 60_000 };
 *
 * export async function POST(request: Request) {
 *   const rl = rateLimit(request, limiter, 'bookings-create');
 *   if (!rl.success) {
 *     return Response.json(
 *       { success: false, error: { code: 'RATE_LIMITED', message: rl.message } },
 *       { status: 429, headers: rl.headers }
 *     );
 *   }
 *   // ... handle request
 * }
 * ```
 *
 * @module lib/rate-limit
 */

export interface RateLimitConfig {
  /** Max number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Seconds until the window resets */
  retryAfterSeconds: number;
  /** Human-readable message (only on failure) */
  message: string;
  /** Headers to include in the response */
  headers: Record<string, string>;
}

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store. Entries are cleaned up periodically.
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(maxWindowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - maxWindowMs;
  store.forEach((entry, key) => {
    entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  });
}

/**
 * Extract a rate limit key from the request.
 * Uses userId (from Clerk auth header) if available, otherwise falls back to IP.
 */
function getKeyFromRequest(request: Request, prefix: string): string {
  // Try to get user ID from the authorization header (Clerk JWT subject)
  // For simplicity, use IP-based limiting. Auth-based limiting would require
  // parsing the JWT which is expensive. The prefix differentiates endpoints.
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Check rate limit for a request.
 *
 * @param request - The incoming request
 * @param config - Rate limit configuration
 * @param prefix - Unique prefix for this endpoint (e.g., 'bookings-create')
 * @returns RateLimitResult with success status and response headers
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig,
  prefix: string
): RateLimitResult {
  const now = Date.now();
  const key = getKeyFromRequest(request, prefix);

  // Run cleanup occasionally
  cleanup(config.windowMs);

  // Get or create entry
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  // Build standard headers
  const remaining = Math.max(0, config.limit - entry.timestamps.length);
  const resetAt =
    entry.timestamps.length > 0
      ? Math.ceil((entry.timestamps[0] + config.windowMs - now) / 1000)
      : Math.ceil(config.windowMs / 1000);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining - 1).toString(),
    'X-RateLimit-Reset': resetAt.toString(),
  };

  // Check if over limit
  if (entry.timestamps.length >= config.limit) {
    const retryAfterSeconds = Math.ceil((entry.timestamps[0] + config.windowMs - now) / 1000);

    return {
      success: false,
      remaining: 0,
      retryAfterSeconds,
      message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      headers: {
        ...headers,
        'Retry-After': retryAfterSeconds.toString(),
        'X-RateLimit-Remaining': '0',
      },
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    success: true,
    remaining: remaining - 1,
    retryAfterSeconds: 0,
    message: '',
    headers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured limiters for common endpoints
// ─────────────────────────────────────────────────────────────────────────────

/** 10 requests per minute — for write operations (bookings, checkout) */
export const WRITE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60_000 };

/** 30 requests per minute — for frequent operations (messages, auth reads) */
export const FREQUENT_LIMIT: RateLimitConfig = { limit: 30, windowMs: 60_000 };

/** 5 requests per minute — for sensitive operations (uploads, reviews) */
export const SENSITIVE_LIMIT: RateLimitConfig = { limit: 5, windowMs: 60_000 };

/** 60 requests per minute — general default */
export const DEFAULT_LIMIT: RateLimitConfig = { limit: 60, windowMs: 60_000 };

/**
 * Helper to create a 429 response with proper headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: result.message,
      },
    },
    { status: 429, headers: result.headers }
  );
}
