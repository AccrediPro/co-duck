import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuth,
  mockDbQueryFindFirst,
  makeRequest,
  makeJsonRequest,
  resetMocks,
} from './setup';

import { GET, PATCH } from '../bookings/[id]/route';

function makeRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/bookings/:id', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await GET(
      makeRequest('https://example.com/api/bookings/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid booking ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });

    const response = await GET(
      makeRequest('https://example.com/api/bookings/abc'),
      makeRouteParams('abc')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 when booking not found or not accessible', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await GET(
      makeRequest('https://example.com/api/bookings/999'),
      makeRouteParams('999')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns booking details for the coach', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst
      // booking
      .mockResolvedValueOnce({
        id: 1,
        coachId: 'user_coach',
        clientId: 'user_client',
        status: 'confirmed',
        sessionType: { name: 'Career Coaching', duration: 60, price: 15000 },
        startTime: new Date('2025-03-01T10:00:00Z'),
        endTime: new Date('2025-03-01T11:00:00Z'),
        clientNotes: 'Looking forward to it',
        coachNotes: 'Review resume beforehand',
        meetingLink: 'https://zoom.us/j/123',
        cancelledBy: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      // coach user
      .mockResolvedValueOnce({
        id: 'user_coach',
        name: 'Coach Name',
        email: 'coach@example.com',
        avatarUrl: null,
      })
      // client user
      .mockResolvedValueOnce({
        id: 'user_client',
        name: 'Client Name',
        email: 'client@example.com',
        avatarUrl: null,
      });

    const response = await GET(
      makeRequest('https://example.com/api/bookings/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(1);
    expect(body.data.isCoach).toBe(true);
    expect(body.data.coachNotes).toBe('Review resume beforehand');
    expect(body.data.status).toBe('confirmed');
  });

  it('hides coachNotes from client', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst
      .mockResolvedValueOnce({
        id: 1,
        coachId: 'user_coach',
        clientId: 'user_client',
        status: 'confirmed',
        sessionType: null,
        startTime: new Date(),
        endTime: new Date(),
        clientNotes: null,
        coachNotes: 'Secret coach notes',
        meetingLink: null,
        cancelledBy: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({ id: 'user_coach', name: 'Coach', email: 'c@e.com', avatarUrl: null })
      .mockResolvedValueOnce({ id: 'user_client', name: 'Client', email: 'cl@e.com', avatarUrl: null });

    const response = await GET(
      makeRequest('https://example.com/api/bookings/1'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(body.data.coachNotes).toBeNull();
    expect(body.data.isCoach).toBe(false);
  });
});

describe('PATCH /api/bookings/:id', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/bookings/1', { meetingLink: 'https://zoom.us' }, 'PATCH'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid ID', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/bookings/abc', { meetingLink: 'https://zoom.us' }, 'PATCH'),
      makeRouteParams('abc')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_ID');
  });

  it('returns 404 when booking not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_coach' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/bookings/999', { meetingLink: 'https://zoom.us' }, 'PATCH'),
      makeRouteParams('999')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when user is not coach or client of booking', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_random' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
      status: 'confirmed',
    });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/bookings/1', { meetingLink: 'https://zoom.us' }, 'PATCH'),
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
      status: 'confirmed', // client can only update clientNotes when status is 'pending'
    });

    const response = await PATCH(
      makeJsonRequest('https://example.com/api/bookings/1', { meetingLink: 'https://zoom.us' }, 'PATCH'),
      makeRouteParams('1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('NO_UPDATES');
  });
});
