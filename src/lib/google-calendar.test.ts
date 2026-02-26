import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for Google Calendar configuration and utility logic.
 *
 * We test `isGoogleCalendarConfigured` which is pure env-var checking.
 * Functions that require googleapis and DB are tested by verifying
 * correct error handling when env vars are missing.
 */

// Mock googleapis before importing the module
vi.mock('googleapis', () => {
  class MockOAuth2 {
    generateAuthUrl() {
      return 'https://accounts.google.com/o/oauth2/v2/auth?mock=true';
    }
    getToken = vi.fn();
    setCredentials = vi.fn();
    refreshAccessToken = vi.fn();
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      calendar: vi.fn(),
    },
  };
});

// Mock the DB module
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  googleCalendarTokens: {},
}));

describe('isGoogleCalendarConfigured', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true when all three env vars are set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

    const { isGoogleCalendarConfigured } = await import('./google-calendar');
    expect(isGoogleCalendarConfigured()).toBe(true);
  });

  it('returns false when GOOGLE_CLIENT_ID is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

    const { isGoogleCalendarConfigured } = await import('./google-calendar');
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it('returns false when GOOGLE_CLIENT_SECRET is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    delete process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

    const { isGoogleCalendarConfigured } = await import('./google-calendar');
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it('returns false when GOOGLE_REDIRECT_URI is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    delete process.env.GOOGLE_REDIRECT_URI;

    const { isGoogleCalendarConfigured } = await import('./google-calendar');
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it('returns false when all env vars are missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;

    const { isGoogleCalendarConfigured } = await import('./google-calendar');
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it('returns false when env vars are empty strings', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GOOGLE_REDIRECT_URI = '';

    const { isGoogleCalendarConfigured } = await import('./google-calendar');
    expect(isGoogleCalendarConfigured()).toBe(false);
  });
});

describe('getGoogleOAuth2Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when Google Calendar is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;

    const { getGoogleOAuth2Client } = await import('./google-calendar');
    expect(() => getGoogleOAuth2Client()).toThrow('Google Calendar is not configured');
  });

  it('returns an OAuth2 client when configured', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

    const { getGoogleOAuth2Client } = await import('./google-calendar');
    const client = getGoogleOAuth2Client();
    expect(client).toBeDefined();
  });
});

describe('getAuthUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a URL string', async () => {
    const { getAuthUrl } = await import('./google-calendar');
    const url = getAuthUrl('user_123');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});

describe('getAuthenticatedClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when no token records exist', async () => {
    const { getAuthenticatedClient } = await import('./google-calendar');
    const client = await getAuthenticatedClient('user_no_tokens');
    expect(client).toBeNull();
  });
});
