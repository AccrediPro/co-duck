import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuth,
  mockCurrentUser,
  mockDbQueryFindFirst,
  mockDbUpdate,
  mockDbInsert,
  makeJsonRequest,
  resetMocks,
} from './setup';

import { POST } from '../auth/sync/route';

describe('POST /api/auth/sync', () => {
  beforeEach(() => {
    resetMocks();
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'user_new',
            email: 'new@example.com',
            name: 'New User',
            avatarUrl: null,
            role: 'client',
          },
        ]),
      }),
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(makeJsonRequest('https://example.com/api/auth/sync', {}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 500 when Clerk user cannot be fetched', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(makeJsonRequest('https://example.com/api/auth/sync', {}));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('CLERK_ERROR');
  });

  it('returns 400 when user has no email', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [],
      firstName: 'John',
      lastName: 'Doe',
      imageUrl: null,
    });

    const response = await POST(makeJsonRequest('https://example.com/api/auth/sync', {}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('NO_EMAIL');
  });

  it('updates existing user and returns isNew=false', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_existing' });
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'existing@example.com' }],
      firstName: 'Jane',
      lastName: 'Doe',
      imageUrl: 'https://img.clerk.com/jane.jpg',
    });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 'user_existing',
      email: 'old@example.com',
      name: 'Jane Old',
      role: 'coach',
    });

    const response = await POST(makeJsonRequest('https://example.com/api/auth/sync', {}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.isNew).toBe(false);
    expect(body.data.role).toBe('coach');
    expect(body.data.email).toBe('existing@example.com');
  });

  it('creates new user with role=client and returns isNew=true', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_new' });
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'new@example.com' }],
      firstName: 'New',
      lastName: 'User',
      imageUrl: null,
    });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await POST(makeJsonRequest('https://example.com/api/auth/sync', {}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.isNew).toBe(true);
    expect(body.data.role).toBe('client');
  });
});
