/**
 * Shared test setup for API route tests.
 * Provides mock factories for Clerk auth, Drizzle DB, and helper utilities.
 */

import { vi } from 'vitest';

// ─── Clerk Auth Mock ───────────────────────────────────────────────
export const mockAuth = vi.fn();
export const mockCurrentUser = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  currentUser: (...args: unknown[]) => mockCurrentUser(...args),
}));

// ─── Rate Limit Mock (always allow) ───────────────────────────────
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({
    success: true,
    remaining: 99,
    retryAfterSeconds: 0,
    message: '',
    headers: {},
  }),
  rateLimitResponse: () =>
    Response.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      { status: 429 }
    ),
  FREQUENT_LIMIT: { limit: 30, windowMs: 60_000 },
  WRITE_LIMIT: { limit: 10, windowMs: 60_000 },
  SENSITIVE_LIMIT: { limit: 5, windowMs: 60_000 },
  DEFAULT_LIMIT: { limit: 60, windowMs: 60_000 },
}));

// ─── Notification Mock ────────────────────────────────────────────
vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}));

// ─── Email Mock ───────────────────────────────────────────────────
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Unsubscribe Mock ─────────────────────────────────────────────
vi.mock('@/lib/unsubscribe', () => ({
  getUnsubscribeUrl: vi.fn().mockReturnValue('https://example.com/unsubscribe'),
}));

// ─── Email Template Mocks ─────────────────────────────────────────
vi.mock('@/lib/emails', () => ({
  ActionItemEmail: vi.fn().mockReturnValue(null),
  ReviewRequestEmail: vi.fn().mockReturnValue(null),
  NewMessageEmail: vi.fn().mockReturnValue(null),
}));

// ─── Socket Server Mock ──────────────────────────────────────────
vi.mock('@/lib/socket-server', () => ({
  getSocketServer: vi.fn().mockReturnValue(null),
}));

// ─── DB Mock ──────────────────────────────────────────────────────
export const mockDbExecute = vi.fn();
export const mockDbQueryFindFirst = vi.fn();
export const mockDbSelect = vi.fn();
export const mockDbInsert = vi.fn();
export const mockDbUpdate = vi.fn();
export const mockDbDelete = vi.fn();

// Chainable query builder mock
function createChainableSelect() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  // Final resolution: returns empty array by default
  chain.then = vi.fn((resolve: (v: unknown[]) => void) => resolve([]));
  return chain;
}

function createChainableInsert() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  return chain;
}

function createChainableUpdate() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  return chain;
}

function createChainableDelete() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

// Create chainable mocks
const selectChain = createChainableSelect();
const insertChain = createChainableInsert();
const updateChain = createChainableUpdate();
const deleteChain = createChainableDelete();

mockDbSelect.mockReturnValue(selectChain);
mockDbInsert.mockReturnValue(insertChain);
mockDbUpdate.mockReturnValue(updateChain);
mockDbDelete.mockReturnValue(deleteChain);

vi.mock('@/db', () => ({
  db: {
    execute: (...args: unknown[]) => mockDbExecute(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    query: {
      users: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      bookings: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      conversations: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      actionItems: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      reviews: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      coachProfiles: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      coachAvailability: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      availabilityOverrides: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
      notifications: { findFirst: (...args: unknown[]) => mockDbQueryFindFirst(...args) },
    },
  },
}));

// ─── DB Schema Mock ───────────────────────────────────────────────
vi.mock('@/db/schema', () => ({
  users: { id: 'id', email: 'email', name: 'name', avatarUrl: 'avatarUrl', role: 'role' },
  coachProfiles: {
    userId: 'userId',
    slug: 'slug',
    headline: 'headline',
    bio: 'bio',
    specialties: 'specialties',
    sessionTypes: 'sessionTypes',
    timezone: 'timezone',
    hourlyRate: 'hourlyRate',
    currency: 'currency',
    averageRating: 'averageRating',
    reviewCount: 'reviewCount',
    verificationStatus: 'verificationStatus',
    isPublished: 'isPublished',
    createdAt: 'createdAt',
    bufferMinutes: 'bufferMinutes',
    advanceNoticeHours: 'advanceNoticeHours',
    maxAdvanceDays: 'maxAdvanceDays',
    videoIntroUrl: 'videoIntroUrl',
  },
  coachAvailability: {
    coachId: 'coachId',
    dayOfWeek: 'dayOfWeek',
    startTime: 'startTime',
    endTime: 'endTime',
    isAvailable: 'isAvailable',
  },
  availabilityOverrides: {
    coachId: 'coachId',
    date: 'date',
    isAvailable: 'isAvailable',
    startTime: 'startTime',
    endTime: 'endTime',
  },
  bookings: {
    id: 'id',
    coachId: 'coachId',
    clientId: 'clientId',
    status: 'status',
    sessionType: 'sessionType',
    startTime: 'startTime',
    endTime: 'endTime',
    meetingLink: 'meetingLink',
    clientNotes: 'clientNotes',
    coachNotes: 'coachNotes',
    cancelledBy: 'cancelledBy',
    cancelledAt: 'cancelledAt',
    cancellationReason: 'cancellationReason',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  transactions: { id: 'id', bookingId: 'bookingId' },
  conversations: {
    id: 'id',
    coachId: 'coachId',
    clientId: 'clientId',
    lastMessageAt: 'lastMessageAt',
    createdAt: 'createdAt',
  },
  messages: {
    id: 'id',
    conversationId: 'conversationId',
    senderId: 'senderId',
    content: 'content',
    messageType: 'messageType',
    isRead: 'isRead',
    createdAt: 'createdAt',
  },
  actionItems: {
    id: 'id',
    coachId: 'coachId',
    clientId: 'clientId',
    title: 'title',
    description: 'description',
    dueDate: 'dueDate',
    isCompleted: 'isCompleted',
    completedAt: 'completedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    bookingId: 'bookingId',
    goalId: 'goalId',
  },
  reviews: {
    id: 'id',
    bookingId: 'bookingId',
    coachId: 'coachId',
    clientId: 'clientId',
    rating: 'rating',
    title: 'title',
    content: 'content',
    coachResponse: 'coachResponse',
    isPublic: 'isPublic',
    createdAt: 'createdAt',
  },
  notifications: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    title: 'title',
    body: 'body',
    link: 'link',
    isRead: 'isRead',
    createdAt: 'createdAt',
  },
  sessionNotes: { id: 'id', bookingId: 'bookingId', coachId: 'coachId', content: 'content' },
}));

// ─── Helpers ──────────────────────────────────────────────────────
export function makeRequest(url: string, options?: RequestInit): Request {
  return new Request(url, {
    headers: { 'x-forwarded-for': '127.0.0.1' },
    ...options,
  });
}

export function makeJsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  });
}

export function resetMocks() {
  mockAuth.mockReset();
  mockCurrentUser.mockReset();
  mockDbExecute.mockReset();
  mockDbQueryFindFirst.mockReset();
}
