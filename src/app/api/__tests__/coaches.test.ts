import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQueryFindFirst, mockDbSelect, makeRequest, resetMocks } from './setup';

import { GET as GET_LIST } from '../coaches/route';
import { GET as GET_BY_SLUG } from '../coaches/[slug]/route';
import { GET as GET_REVIEWS } from '../coaches/[slug]/reviews/route';
import { GET as GET_AVAILABILITY } from '../coaches/[slug]/availability/[date]/route';

function makeSlugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function makeAvailParams(slug: string, date: string) {
  return { params: Promise.resolve({ slug, date }) };
}

describe('GET /api/coaches', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns paginated coach list', async () => {
    const coaches = [
      {
        userId: 'user_coach1',
        slug: 'john-smith',
        headline: 'Executive Coach',
        bio: 'Great coach',
        specialties: ['Career'],
        sessionTypes: [],
        timezone: 'America/New_York',
        hourlyRate: 15000,
        currency: 'USD',
        averageRating: '4.80',
        reviewCount: 10,
        verificationStatus: 'verified',
        userName: 'John Smith',
        userEmail: 'john@example.com',
        userAvatar: null,
      },
    ];

    const coachSelectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(coaches),
    };
    const countSelectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };

    mockDbSelect.mockReturnValueOnce(coachSelectChain).mockReturnValueOnce(countSelectChain);

    const response = await GET_LIST(makeRequest('https://example.com/api/coaches?page=1&limit=20'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.coaches).toHaveLength(1);
    expect(body.data.coaches[0].slug).toBe('john-smith');
    expect(body.data.coaches[0].isVerified).toBe(true);
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.total).toBe(1);
  });

  it('clamps limit to maximum 50', async () => {
    const emptySelect = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const countSelect = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    };

    mockDbSelect.mockReturnValueOnce(emptySelect).mockReturnValueOnce(countSelect);

    const response = await GET_LIST(makeRequest('https://example.com/api/coaches?limit=999'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.pagination.limit).toBe(50);
  });
});

describe('GET /api/coaches/:slug', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 404 when coach not found', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    const response = await GET_BY_SLUG(
      makeRequest('https://example.com/api/coaches/unknown-coach'),
      makeSlugParams('unknown-coach')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when coach is not published', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: 'user_coach',
          slug: 'draft-coach',
          isPublished: false,
          headline: 'Draft',
          bio: null,
          specialties: [],
          sessionTypes: [],
          timezone: 'UTC',
          hourlyRate: 10000,
          currency: 'USD',
          videoIntroUrl: null,
          bufferMinutes: 15,
          advanceNoticeHours: 24,
          maxAdvanceDays: 60,
          userName: 'Draft Coach',
          userEmail: 'draft@e.com',
          userAvatar: null,
        },
      ]),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    const response = await GET_BY_SLUG(
      makeRequest('https://example.com/api/coaches/draft-coach'),
      makeSlugParams('draft-coach')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_PUBLISHED');
  });

  it('returns coach profile with availability for published coach', async () => {
    const coachSelect = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: 'user_coach',
          slug: 'jane-doe',
          isPublished: true,
          headline: 'Life Coach',
          bio: 'Experienced',
          specialties: ['Life'],
          sessionTypes: [{ id: 's1', name: 'Intro', duration: 30, price: 5000 }],
          timezone: 'Europe/London',
          hourlyRate: 12000,
          currency: 'GBP',
          videoIntroUrl: null,
          bufferMinutes: 10,
          advanceNoticeHours: 12,
          maxAdvanceDays: 30,
          userName: 'Jane Doe',
          userEmail: 'jane@e.com',
          userAvatar: 'https://img.com/jane.jpg',
        },
      ]),
    };
    const availSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi
        .fn()
        .mockResolvedValue([
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isAvailable: true },
        ]),
    };

    mockDbSelect.mockReturnValueOnce(coachSelect).mockReturnValueOnce(availSelect);

    const response = await GET_BY_SLUG(
      makeRequest('https://example.com/api/coaches/jane-doe'),
      makeSlugParams('jane-doe')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.slug).toBe('jane-doe');
    expect(body.data.name).toBe('Jane Doe');
    expect(body.data.availability.bufferMinutes).toBe(10);
    expect(body.data.availability.weeklySchedule).toHaveLength(1);
  });
});

describe('GET /api/coaches/:slug/reviews', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 404 when coach not found', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    const response = await GET_REVIEWS(
      makeRequest('https://example.com/api/coaches/unknown/reviews'),
      makeSlugParams('unknown')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when coach is not published', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockResolvedValue([
          { userId: 'user_coach', isPublished: false, averageRating: null, reviewCount: 0 },
        ]),
    };
    mockDbSelect.mockReturnValueOnce(selectChain);

    const response = await GET_REVIEWS(
      makeRequest('https://example.com/api/coaches/unpublished/reviews'),
      makeSlugParams('unpublished')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_PUBLISHED');
  });
});

describe('GET /api/coaches/:slug/availability/:date', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns 400 for invalid date format', async () => {
    const response = await GET_AVAILABILITY(
      makeRequest('https://example.com/api/coaches/coach/availability/2025-3-1'),
      makeAvailParams('coach', '2025-3-1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_DATE');
  });

  it('returns 404 when coach not found', async () => {
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await GET_AVAILABILITY(
      makeRequest('https://example.com/api/coaches/unknown/availability/2025-03-15'),
      makeAvailParams('unknown', '2025-03-15')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when coach is not published', async () => {
    mockDbQueryFindFirst.mockResolvedValueOnce({
      userId: 'user_coach',
      slug: 'draft',
      isPublished: false,
    });

    const response = await GET_AVAILABILITY(
      makeRequest('https://example.com/api/coaches/draft/availability/2025-03-15'),
      makeAvailParams('draft', '2025-03-15')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_PUBLISHED');
  });

  it('returns empty slots when not available on that day', async () => {
    // coach profile found
    mockDbQueryFindFirst.mockResolvedValueOnce({
      userId: 'user_coach',
      slug: 'coach',
      isPublished: true,
      timezone: 'America/New_York',
      bufferMinutes: 15,
      advanceNoticeHours: 24,
      maxAdvanceDays: 60,
    });
    // no override
    mockDbQueryFindFirst.mockResolvedValueOnce(null);
    // no weekly availability for that day
    mockDbQueryFindFirst.mockResolvedValueOnce(null);

    const response = await GET_AVAILABILITY(
      makeRequest('https://example.com/api/coaches/coach/availability/2025-03-15'),
      makeAvailParams('coach', '2025-03-15')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.slots).toEqual([]);
    expect(body.data.date).toBe('2025-03-15');
  });
});
