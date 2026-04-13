import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockAuth,
  mockDbQueryFindFirst,
  mockDbInsert,
  mockDbSelect,
  mockDbUpdate,
  makeJsonRequest,
  resetMocks,
} from './setup';

import { POST } from '../reviews/route';

describe('POST /api/reviews', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1, rating: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when bookingId is missing', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });

    const response = await POST(makeJsonRequest('https://example.com/api/reviews', { rating: 5 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when rating is missing', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when rating is out of range (0)', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1, rating: 0 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_RATING');
  });

  it('returns 400 when rating is out of range (6)', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1, rating: 6 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_RATING');
  });

  it('returns 404 when booking not found', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce(null); // booking not found

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 999, rating: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('returns 403 when user is not the client of the booking', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_other' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
      status: 'completed',
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1, rating: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('NOT_AUTHORIZED');
  });

  it('returns 400 when booking is not completed', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
      status: 'confirmed',
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1, rating: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('BOOKING_NOT_COMPLETED');
  });

  it('returns 409 when review already exists for booking', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    // First findFirst: booking
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
      status: 'completed',
    });
    // Second findFirst: existing review
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 10,
      bookingId: 1,
      rating: 4,
    });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', { bookingId: 1, rating: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('ALREADY_REVIEWED');
  });

  it('creates review successfully and returns data', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_client' });
    // booking found
    mockDbQueryFindFirst.mockResolvedValueOnce({
      id: 1,
      coachId: 'user_coach',
      clientId: 'user_client',
      status: 'completed',
    });
    // no existing review
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    // insert review
    mockDbInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 20,
            bookingId: 1,
            rating: 5,
            title: 'Great!',
            content: 'Loved it',
            isPublic: true,
            createdAt: new Date().toISOString(),
          },
        ]),
      }),
    });

    // stats query for updating coach profile
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ avgRating: '4.50', totalCount: 10 }]),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    // update coach profile
    mockDbUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    // reviewer user lookup
    mockDbQueryFindFirst.mockResolvedValueOnce({ id: 'user_client', name: 'Client Name' });

    const response = await POST(
      makeJsonRequest('https://example.com/api/reviews', {
        bookingId: 1,
        rating: 5,
        title: 'Great!',
        content: 'Loved it',
        isPublic: true,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(20);
    expect(body.data.rating).toBe(5);
    expect(body.data.title).toBe('Great!');
  });
});
