import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuth,
  mockDbQueryFindFirst,
  mockDbSelect,
  mockDbDelete,
  makeRequest,
  makeJsonRequest,
  resetMocks,
} from './setup';

import { GET, POST } from '../action-items/route';
import {
  GET as GET_BY_ID,
  PATCH,
  DELETE,
} from '../action-items/[id]/route';

function makeRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/action-items', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await GET(makeRequest('https://example.com/api/action-items'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns action items for authenticated user', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });

    const items = [
      {
        id: 1,
        coachId: 'user_coach',
        clientId: 'user_client',
        title: 'Task 1',
        description: 'Desc',
        dueDate: '2025-03-01',
        isCompleted: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookingId: null,
        goalId: null,
      },
    ];

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(items),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    // users lookup
    const usersSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: 'user_coach', name: 'Coach', avatarUrl: null },
        { id: 'user_client', name: 'Client', avatarUrl: null },
      ]),
    };
    mockDbSelect.mockReturnValueOnce(usersSelectChain);

    const response = await GET(makeRequest('https://example.com/api/action-items'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.actionItems).toHaveLength(1);
    expect(body.data.actionItems[0].title).toBe('Task 1');
    expect(body.data.actionItems[0].isCoach).toBe(true);
  });
});

describe('POST /api/action-items', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(
      makeJsonRequest('https://example.com/api/action-items', {
        clientId: 'user_client',
        title: 'New task',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when clientId is missing', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/action-items', { title: 'Task' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when title is missing', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/action-items', { clientId: 'user_client' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 403 when user is not a coach', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 'user_client',
      role: 'client',
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/action-items', {
        clientId: 'user_other',
        title: 'New task',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when client not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst
      .mockResolvedValueOnce({ id: 'user_coach', role: 'coach' })
      .mockResolvedValueOnce(null); // client not found

    const response = await POST(
      makeJsonRequest('https://example.com/api/action-items', {
        clientId: 'user_unknown',
        title: 'Task',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('returns 400 for invalid date format', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst
      .mockResolvedValueOnce({ id: 'user_coach', role: 'coach', name: 'Coach', email: 'c@e.com' })
      .mockResolvedValueOnce({ id: 'user_client', role: 'client', email: 'cl@e.com' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/action-items', {
        clientId: 'user_client',
        title: 'Task',
        dueDate: '03-01-2025', // wrong format
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_DATE');
  });
});

describe('GET /api/action-items/:id', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await GET_BY_ID(
      makeRequest('https://example.com/api/action-items/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await GET_BY_ID(
      makeRequest('https://example.com/api/action-items/abc'),
      makeRouteParams('abc')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 when item not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await GET_BY_ID(
      makeRequest('https://example.com/api/action-items/999'),
      makeRouteParams('999')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/action-items/:id', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 403 when user is neither coach nor client', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_random' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
    });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/action-items/1', { isCompleted: true }, 'PATCH'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when no valid updates provided', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
    });

    // Client sends title update (coach-only field) with no isCompleted
    const response = await PATCH(
      makeJsonRequest('https://example.com/api/action-items/1', { title: 'New title' }, 'PATCH'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('NO_UPDATES');
  });
});

describe('DELETE /api/action-items/:id', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await DELETE(
      makeRequest('https://example.com/api/action-items/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when item not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(
      makeRequest('https://example.com/api/action-items/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when client tries to delete', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
    });

    const response = await DELETE(
      makeRequest('https://example.com/api/action-items/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('deletes action item successfully when coach', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
    });

    mockDbDelete.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const response = await DELETE(
      makeRequest('https://example.com/api/action-items/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('deleted');
  });
});
