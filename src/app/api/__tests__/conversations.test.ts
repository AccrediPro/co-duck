import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuth,
  mockDbQueryFindFirst,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  makeRequest,
  makeJsonRequest,
  resetMocks,
} from './setup';

import { GET, POST } from '../conversations/route';
import { GET as GET_MESSAGES, POST as POST_MESSAGE } from '../conversations/[id]/messages/route';
import { POST as POST_READ } from '../conversations/[id]/read/route';

function makeRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/conversations', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await GET(makeRequest('https://example.com/api/conversations'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns empty array when user has no conversations', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    const response = await GET(makeRequest('https://example.com/api/conversations'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.conversations).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });
});

describe('POST /api/conversations', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(
      makeJsonRequest('https://example.com/api/conversations', { otherUserId: 'user_456' })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when otherUserId is missing', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await POST(makeJsonRequest('https://example.com/api/conversations', {}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when creating conversation with yourself', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/conversations', { otherUserId: 'user_123' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_USER');
  });

  it('returns 404 when other user not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    // currentUser
    mockDbQueryFindFirst.mockResolvedValueOnce({ id: 'user_123', role: 'client' });
    // otherUser not found
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await POST(
      makeJsonRequest('https://example.com/api/conversations', { otherUserId: 'user_unknown' })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns existing conversation if already exists', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    // currentUser
    mockDbQueryFindFirst.mockResolvedValueOnce({ id: 'user_client', role: 'client' });
    // otherUser
    mockDbQueryFindFirst.mockResolvedValueOnce({ id: 'user_coach', role: 'coach' });
    // existing conversation
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 5,
      coachId: 'user_coach',
      clientId: 'user_client',
      lastMessageAt: null,
      createdAt: new Date().toISOString(),
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/conversations', { otherUserId: 'user_coach' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(5);
    expect(body.data.isNew).toBe(false);
  });

  it('creates new conversation when none exists', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce({ id: 'user_client', role: 'client' });
    mockDbQueryFindFirst.mockResolvedValueOnce({ id: 'user_coach', role: 'coach' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null); // no existing conv

    mockDbInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 10,
            coachId: 'user_coach',
            clientId: 'user_client',
            lastMessageAt: null,
            createdAt: new Date().toISOString(),
          },
        ]),
      }),
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/conversations', { otherUserId: 'user_coach' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(10);
    expect(body.data.isNew).toBe(true);
  });
});

describe('GET /api/conversations/:id/messages', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await GET_MESSAGES(
      makeRequest('https://example.com/api/conversations/1/messages'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid conversation ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await GET_MESSAGES(
      makeRequest('https://example.com/api/conversations/abc/messages'),
      makeRouteParams('abc')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 when conversation not found or not accessible', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await GET_MESSAGES(
      makeRequest('https://example.com/api/conversations/999/messages'),
      makeRouteParams('999')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/conversations/:id/messages', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST_MESSAGE(
      makeJsonRequest('https://example.com/api/conversations/1/messages', { content: 'Hello' }),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid conversation ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await POST_MESSAGE(
      makeJsonRequest('https://example.com/api/conversations/abc/messages', { content: 'Hello' }),
      makeRouteParams('abc')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 400 when content is empty', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await POST_MESSAGE(
      makeJsonRequest('https://example.com/api/conversations/1/messages', { content: '' }),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_CONTENT');
  });

  it('returns 400 when content is whitespace-only', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await POST_MESSAGE(
      makeJsonRequest('https://example.com/api/conversations/1/messages', { content: '   ' }),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_CONTENT');
  });

  it('returns 404 when conversation not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await POST_MESSAGE(
      makeJsonRequest('https://example.com/api/conversations/999/messages', { content: 'Hello' }),
      makeRouteParams('999')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/conversations/:id/read', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST_READ(
      makeJsonRequest('https://example.com/api/conversations/1/read', {}),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid conversation ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await POST_READ(
      makeJsonRequest('https://example.com/api/conversations/xyz/read', {}),
      makeRouteParams('xyz')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 when conversation not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await POST_READ(
      makeJsonRequest('https://example.com/api/conversations/999/read', {}),
      makeRouteParams('999')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('marks unread messages as read and returns count', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_123',
    });

    mockDbUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
        }),
      }),
    });

    const response = await POST_READ(
      makeJsonRequest('https://example.com/api/conversations/1/read', {}),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.markedAsRead).toBe(2);
  });
});
