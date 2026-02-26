import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuth,
  mockDbSelect,
  mockDbUpdate,
  makeRequest,
  makeJsonRequest,
  resetMocks,
} from './setup';

import { GET, PATCH } from '../notifications/route';
import { POST } from '../notifications/read-all/route';

describe('GET /api/notifications', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await GET(makeRequest('https://example.com/api/notifications'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns notifications with unread count', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    // Mock Promise.all: [notifications, unreadCount]
    const notificationsList = [
      {
        id: 1,
        type: 'new_message',
        title: 'New message',
        body: 'Hello',
        link: '/dashboard/messages/1',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        type: 'session_completed',
        title: 'Session done',
        body: 'Your session is complete',
        link: '/dashboard/sessions/1',
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ];

    // Mock the parallel queries - notifications select chain
    const notifChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(notificationsList),
    };
    // Unread count chain
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };

    mockDbSelect
      .mockReturnValueOnce(notifChain)
      .mockReturnValueOnce(countChain);

    const response = await GET(
      makeRequest('https://example.com/api/notifications?limit=30')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.notifications).toHaveLength(2);
    expect(body.data.unreadCount).toBe(1);
  });
});

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/notifications', { id: 1 }, 'PATCH')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid notification ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/notifications', { id: 'abc' }, 'PATCH')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 when notification not found or not owned', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    mockDbUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/notifications', { id: 999 }, 'PATCH')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('marks notification as read successfully', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    mockDbUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 5, isRead: true }]),
        }),
      }),
    });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/notifications', { id: 5 }, 'PATCH')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(5);
    expect(body.data.isRead).toBe(true);
  });
});

describe('POST /api/notifications/read-all', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(
      makeJsonRequest('https://example.com/api/notifications/read-all', {})
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('marks all unread notifications as read and returns count', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    mockDbUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
        }),
      }),
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/notifications/read-all', {})
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.markedRead).toBe(3);
  });

  it('returns 0 when no unread notifications', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    mockDbUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/notifications/read-all', {})
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.markedRead).toBe(0);
  });
});
