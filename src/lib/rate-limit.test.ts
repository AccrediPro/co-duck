import { describe, it, expect } from 'vitest';
import {
  rateLimit,
  rateLimitResponse,
  rateLimitByIp,
  extractIp,
  resolveMiddlewareRateLimit,
  WRITE_LIMIT,
  FREQUENT_LIMIT,
  SENSITIVE_LIMIT,
  STRICT_LIMIT,
  DEFAULT_LIMIT,
  MIDDLEWARE_RATE_LIMITS,
  MIDDLEWARE_DEFAULT_LIMIT,
  type RateLimitConfig,
} from './rate-limit';

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers(headers);
  return new Request('https://example.com/api/test', { headers: h });
}

// The in-memory store is a module-level Map. Between tests we use unique prefixes
// to isolate state, since we can't easily reset the module singleton.
let testId = 0;
function uniquePrefix(): string {
  return `test-${++testId}-${Date.now()}`;
}

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 5, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });

    const result = rateLimit(req, config, prefix);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4); // 5 limit - 1 used = 4
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.message).toBe('');
  });

  it('blocks requests over the limit', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 3, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.1' });

    // Use up all 3 slots
    rateLimit(req, config, prefix);
    rateLimit(req, config, prefix);
    rateLimit(req, config, prefix);

    // 4th request should be blocked
    const result = rateLimit(req, config, prefix);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.message).toContain('Too many requests');
  });

  it('returns correct remaining count as requests are made', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 5, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.2' });

    const r1 = rateLimit(req, config, prefix);
    expect(r1.remaining).toBe(4);

    const r2 = rateLimit(req, config, prefix);
    expect(r2.remaining).toBe(3);

    const r3 = rateLimit(req, config, prefix);
    expect(r3.remaining).toBe(2);

    const r4 = rateLimit(req, config, prefix);
    expect(r4.remaining).toBe(1);

    const r5 = rateLimit(req, config, prefix);
    expect(r5.remaining).toBe(0);
  });

  it('returns Retry-After header when rate limited', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.3' });

    rateLimit(req, config, prefix); // use up the limit

    const result = rateLimit(req, config, prefix);
    expect(result.success).toBe(false);
    expect(result.headers['Retry-After']).toBeDefined();
    expect(Number(result.headers['Retry-After'])).toBeGreaterThan(0);
    expect(result.headers['X-RateLimit-Remaining']).toBe('0');
    expect(result.headers['X-RateLimit-Limit']).toBe('1');
  });

  it('treats different keys (prefixes) independently', () => {
    const prefixA = uniquePrefix();
    const prefixB = uniquePrefix();
    const config: RateLimitConfig = { limit: 2, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.4' });

    // Exhaust limit for prefixA
    rateLimit(req, config, prefixA);
    rateLimit(req, config, prefixA);
    const blockedA = rateLimit(req, config, prefixA);
    expect(blockedA.success).toBe(false);

    // prefixB should still allow requests
    const allowedB = rateLimit(req, config, prefixB);
    expect(allowedB.success).toBe(true);
  });

  it('treats different IPs independently', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };

    const reqA = makeRequest({ 'x-forwarded-for': '192.168.1.1' });
    const reqB = makeRequest({ 'x-forwarded-for': '192.168.1.2' });

    rateLimit(reqA, config, prefix); // use up IP A's limit
    const blockedA = rateLimit(reqA, config, prefix);
    expect(blockedA.success).toBe(false);

    // IP B should still be allowed
    const allowedB = rateLimit(reqB, config, prefix);
    expect(allowedB.success).toBe(true);
  });

  it('extracts IP from x-forwarded-for (first entry)', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };

    // x-forwarded-for with multiple IPs — should use the first
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178' });
    rateLimit(req, config, prefix);

    // Same first IP, different trailing proxies — should be rate limited
    const req2 = makeRequest({ 'x-forwarded-for': '203.0.113.50, 1.2.3.4' });
    const result = rateLimit(req2, config, prefix);
    expect(result.success).toBe(false);
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };

    const req = makeRequest({ 'x-real-ip': '10.20.30.40' });
    rateLimit(req, config, prefix);

    const req2 = makeRequest({ 'x-real-ip': '10.20.30.40' });
    const result = rateLimit(req2, config, prefix);
    expect(result.success).toBe(false);
  });

  it('uses "unknown" when no IP headers are present', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };

    const req = makeRequest(); // no IP headers
    rateLimit(req, config, prefix);

    const req2 = makeRequest();
    const result = rateLimit(req2, config, prefix);
    expect(result.success).toBe(false); // same "unknown" key
  });

  it('includes standard rate limit headers on successful responses', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 10, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.5' });

    const result = rateLimit(req, config, prefix);
    expect(result.headers['X-RateLimit-Limit']).toBe('10');
    expect(result.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(result.headers['X-RateLimit-Reset']).toBeDefined();
  });
});

describe('pre-configured rate limit tiers', () => {
  it('WRITE_LIMIT allows 10 requests per minute', () => {
    expect(WRITE_LIMIT.limit).toBe(10);
    expect(WRITE_LIMIT.windowMs).toBe(60_000);
  });

  it('FREQUENT_LIMIT allows 30 requests per minute', () => {
    expect(FREQUENT_LIMIT.limit).toBe(30);
    expect(FREQUENT_LIMIT.windowMs).toBe(60_000);
  });

  it('SENSITIVE_LIMIT allows 5 requests per minute', () => {
    expect(SENSITIVE_LIMIT.limit).toBe(5);
    expect(SENSITIVE_LIMIT.windowMs).toBe(60_000);
  });

  it('STRICT_LIMIT is an alias for SENSITIVE_LIMIT', () => {
    expect(STRICT_LIMIT).toBe(SENSITIVE_LIMIT);
  });

  it('DEFAULT_LIMIT allows 60 requests per minute', () => {
    expect(DEFAULT_LIMIT.limit).toBe(60);
    expect(DEFAULT_LIMIT.windowMs).toBe(60_000);
  });
});

describe('rateLimitResponse', () => {
  it('returns a 429 Response with proper body and headers', async () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.6' });

    rateLimit(req, config, prefix);
    const limitedResult = rateLimit(req, config, prefix);

    const response = rateLimitResponse(limitedResult);
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toContain('Too many requests');

    expect(response.headers.get('Retry-After')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});

describe('extractIp', () => {
  it('returns requestIp when provided', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(extractIp(req, '99.99.99.99')).toBe('99.99.99.99');
  });

  it('falls back to x-forwarded-for when requestIp is null', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(extractIp(req, null)).toBe('1.2.3.4');
  });

  it('falls back to x-forwarded-for when requestIp is undefined', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(extractIp(req)).toBe('1.2.3.4');
  });

  it('uses first IP from x-forwarded-for chain', () => {
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' });
    expect(extractIp(req)).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '172.16.0.1' });
    expect(extractIp(req)).toBe('172.16.0.1');
  });

  it('returns "unknown" when no IP headers and no requestIp', () => {
    const req = makeRequest();
    expect(extractIp(req)).toBe('unknown');
  });

  it('trims whitespace from x-forwarded-for IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' });
    expect(extractIp(req)).toBe('10.0.0.1');
  });
});

describe('rateLimitByIp', () => {
  it('allows requests under the limit', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 5, windowMs: 60_000 };

    const result = rateLimitByIp('1.2.3.4', config, prefix);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests over the limit', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 2, windowMs: 60_000 };

    rateLimitByIp('5.6.7.8', config, prefix);
    rateLimitByIp('5.6.7.8', config, prefix);
    const result = rateLimitByIp('5.6.7.8', config, prefix);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.headers['Retry-After']).toBeDefined();
  });

  it('tracks different IPs independently', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 1, windowMs: 60_000 };

    rateLimitByIp('10.0.0.1', config, prefix);
    const blockedA = rateLimitByIp('10.0.0.1', config, prefix);
    expect(blockedA.success).toBe(false);

    const allowedB = rateLimitByIp('10.0.0.2', config, prefix);
    expect(allowedB.success).toBe(true);
  });

  it('includes standard rate limit headers', () => {
    const prefix = uniquePrefix();
    const config: RateLimitConfig = { limit: 10, windowMs: 60_000 };

    const result = rateLimitByIp('1.1.1.1', config, prefix);
    expect(result.headers['X-RateLimit-Limit']).toBe('10');
    expect(result.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(result.headers['X-RateLimit-Reset']).toBeDefined();
  });
});

describe('resolveMiddlewareRateLimit', () => {
  it('matches /api/auth to auth config', () => {
    const result = resolveMiddlewareRateLimit('/api/auth/me');
    expect(result.config.limit).toBe(5);
    expect(result.prefix).toBe('mw:/api/auth');
  });

  it('matches /api/webhooks to webhooks config', () => {
    const result = resolveMiddlewareRateLimit('/api/webhooks/stripe');
    expect(result.config.limit).toBe(100);
    expect(result.prefix).toBe('mw:/api/webhooks');
  });

  it('matches /api/cron to cron config', () => {
    const result = resolveMiddlewareRateLimit('/api/cron/session-reminders');
    expect(result.config.limit).toBe(10);
    expect(result.prefix).toBe('mw:/api/cron');
  });

  it('falls back to default for unmatched /api/* routes', () => {
    const result = resolveMiddlewareRateLimit('/api/coaches/john');
    expect(result.config).toBe(MIDDLEWARE_DEFAULT_LIMIT);
    expect(result.prefix).toBe('mw:/api');
  });

  it('falls back to default for root /api path', () => {
    const result = resolveMiddlewareRateLimit('/api');
    expect(result.config).toBe(MIDDLEWARE_DEFAULT_LIMIT);
  });

  it('matches based on prefix, not exact path', () => {
    const result = resolveMiddlewareRateLimit('/api/auth/google/callback');
    expect(result.config.limit).toBe(5);
    expect(result.prefix).toBe('mw:/api/auth');
  });
});

describe('MIDDLEWARE_RATE_LIMITS config', () => {
  it('has entries for auth, webhooks, and cron', () => {
    const prefixes = MIDDLEWARE_RATE_LIMITS.map((r) => r.prefix);
    expect(prefixes).toContain('/api/auth');
    expect(prefixes).toContain('/api/webhooks');
    expect(prefixes).toContain('/api/cron');
  });

  it('MIDDLEWARE_DEFAULT_LIMIT is 30/min', () => {
    expect(MIDDLEWARE_DEFAULT_LIMIT.limit).toBe(30);
    expect(MIDDLEWARE_DEFAULT_LIMIT.windowMs).toBe(60_000);
  });
});
