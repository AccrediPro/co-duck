'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, gte, lte, desc, asc, sql, ne, inArray } from 'drizzle-orm';
import {
  db,
  bookings,
  users,
  transactions,
  coachProfiles,
  conversations,
  messages,
  actionItems,
} from '@/db';
import type { BookingSessionType } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface DashboardSession {
  id: number;
  clientId: string;
  clientName: string | null;
  clientAvatar: string | null;
  clientEmail: string;
  coachId: string;
  coachName: string | null;
  coachAvatar: string | null;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  status: string;
  meetingLink: string | null;
}

export interface MessagePreview {
  conversationId: number;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  lastMessageContent: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
}

export interface CoachDashboardData {
  todaysSessions: DashboardSession[];
  upcomingSessions: DashboardSession[];
  revenue: {
    thisMonth: number;
    total: number;
    pending: number;
    currency: string;
  };
  unreadMessageCount: number;
  recentMessages: MessagePreview[];
  pendingActionItemsCount: number;
  pendingBookingRequests: number;
  sessionStats: {
    distinctClients: number;
    sessionsThisMonth: number;
    totalSessions: number;
  };
  averageRating: number;
  profile: {
    isPublished: boolean;
    completionPercentage: number;
    slug: string;
  };
}

export interface ClientDashboardData {
  upcomingSessions: Array<DashboardSession & { coachSlug: string }>;
  unreadMessageCount: number;
  recentMessages: MessagePreview[];
  pendingActionItemsCount: number;
  distinctCoachCount: number;
  recentActionItems: Array<{
    id: number;
    title: string;
    dueDate: string | null;
    coachName: string | null;
    isCompleted: boolean;
  }>;
  sessionHistory: {
    completedCount: number;
    totalHours: number;
  };
}

export interface CalendarSession {
  id: number;
  otherUserName: string | null;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  status: string;
}

// ============================================================================
// Coach Dashboard Data
// ============================================================================

export async function getCoachDashboardData(): Promise<
  { success: true; data: CoachDashboardData } | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todaysSessionsRaw,
      upcomingSessionsRaw,
      totalEarningsResult,
      thisMonthEarningsResult,
      pendingPayoutsResult,
      profileResult,
      unreadCount,
      recentMessagesData,
      pendingItemsResult,
      distinctClientsResult,
      sessionsThisMonthResult,
      totalSessionsResult,
      pendingBookingRequestsResult,
    ] = await Promise.all([
      // Today's sessions
      db
        .select({
          id: bookings.id,
          clientId: bookings.clientId,
          clientName: users.name,
          clientAvatar: users.avatarUrl,
          clientEmail: users.email,
          sessionType: bookings.sessionType,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          meetingLink: bookings.meetingLink,
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.clientId, users.id))
        .where(
          and(
            eq(bookings.coachId, userId),
            gte(bookings.startTime, todayStart),
            lte(bookings.startTime, todayEnd),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
          )
        )
        .orderBy(asc(bookings.startTime)),

      // Upcoming sessions (next 5)
      db
        .select({
          id: bookings.id,
          clientId: bookings.clientId,
          clientName: users.name,
          clientAvatar: users.avatarUrl,
          clientEmail: users.email,
          sessionType: bookings.sessionType,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          meetingLink: bookings.meetingLink,
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.clientId, users.id))
        .where(
          and(
            eq(bookings.coachId, userId),
            gte(bookings.startTime, now),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
          )
        )
        .orderBy(asc(bookings.startTime))
        .limit(5),

      // Total earnings
      db
        .select({ total: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)` })
        .from(transactions)
        .where(and(eq(transactions.coachId, userId), eq(transactions.status, 'succeeded'))),

      // This month earnings
      db
        .select({ total: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.coachId, userId),
            eq(transactions.status, 'succeeded'),
            gte(transactions.createdAt, startOfMonth)
          )
        ),

      // Pending payouts
      db
        .select({ total: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)` })
        .from(transactions)
        .where(and(eq(transactions.coachId, userId), eq(transactions.status, 'pending'))),

      // Profile
      db
        .select({
          isPublished: coachProfiles.isPublished,
          completionPercentage: coachProfiles.profileCompletionPercentage,
          slug: coachProfiles.slug,
          currency: coachProfiles.currency,
          averageRating: coachProfiles.averageRating,
        })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, userId))
        .limit(1),

      // Unread messages
      getUnreadCountForUser(userId),

      // Recent messages (last 3)
      getRecentMessagesForUser(userId, 3),

      // Pending action items (items coach assigned that are incomplete)
      db
        .select({ count: sql<number>`count(*)` })
        .from(actionItems)
        .where(and(eq(actionItems.coachId, userId), eq(actionItems.isCompleted, false))),

      // Distinct clients
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${bookings.clientId})` })
        .from(bookings)
        .where(
          and(
            eq(bookings.coachId, userId),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'completed'))
          )
        ),

      // Sessions this month
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.coachId, userId),
            gte(bookings.startTime, startOfMonth),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'completed'))
          )
        ),

      // Total sessions
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.coachId, userId),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'completed'))
          )
        ),

      // Pending booking requests (future bookings with 'pending' status)
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.coachId, userId),
            eq(bookings.status, 'pending'),
            gte(bookings.startTime, now)
          )
        ),
    ]);

    const profile = profileResult[0];
    if (!profile) return { success: false, error: 'Coach profile not found' };

    const todaysSessions: DashboardSession[] = todaysSessionsRaw.map((s) => ({
      ...s,
      coachId: userId,
      coachName: null,
      coachAvatar: null,
    }));

    const upcomingSessions: DashboardSession[] = upcomingSessionsRaw.map((s) => ({
      ...s,
      coachId: userId,
      coachName: null,
      coachAvatar: null,
    }));

    return {
      success: true,
      data: {
        todaysSessions,
        upcomingSessions,
        revenue: {
          thisMonth: Number(thisMonthEarningsResult[0]?.total || 0),
          total: Number(totalEarningsResult[0]?.total || 0),
          pending: Number(pendingPayoutsResult[0]?.total || 0),
          currency: profile.currency || 'USD',
        },
        unreadMessageCount: unreadCount,
        recentMessages: recentMessagesData,
        pendingActionItemsCount: Number(pendingItemsResult[0]?.count || 0),
        pendingBookingRequests: Number(pendingBookingRequestsResult[0]?.count || 0),
        averageRating: parseFloat(profile.averageRating || '0'),
        sessionStats: {
          distinctClients: Number(distinctClientsResult[0]?.count || 0),
          sessionsThisMonth: Number(sessionsThisMonthResult[0]?.count || 0),
          totalSessions: Number(totalSessionsResult[0]?.count || 0),
        },
        profile: {
          isPublished: profile.isPublished,
          completionPercentage: profile.completionPercentage,
          slug: profile.slug,
        },
      },
    };
  } catch (error) {
    console.error('Error fetching coach dashboard data:', error);
    return { success: false, error: 'Failed to load dashboard data' };
  }
}

// ============================================================================
// Client Dashboard Data
// ============================================================================

export async function getClientDashboardData(): Promise<
  { success: true; data: ClientDashboardData } | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const now = new Date();

    const [
      upcomingSessionsRaw,
      unreadCount,
      recentMessagesData,
      pendingItemsResult,
      recentItemsRaw,
      completedSessionsResult,
      totalHoursResult,
      distinctCoachesResult,
    ] = await Promise.all([
      // Upcoming sessions with coach info (next 5)
      db
        .select({
          id: bookings.id,
          coachId: bookings.coachId,
          coachName: users.name,
          coachAvatar: users.avatarUrl,
          coachSlug: coachProfiles.slug,
          sessionType: bookings.sessionType,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          meetingLink: bookings.meetingLink,
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.coachId, users.id))
        .innerJoin(coachProfiles, eq(bookings.coachId, coachProfiles.userId))
        .where(
          and(
            eq(bookings.clientId, userId),
            gte(bookings.startTime, now),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
          )
        )
        .orderBy(asc(bookings.startTime))
        .limit(5),

      // Unread messages
      getUnreadCountForUser(userId),

      // Recent messages (last 3)
      getRecentMessagesForUser(userId, 3),

      // Pending action items count
      db
        .select({ count: sql<number>`count(*)` })
        .from(actionItems)
        .where(and(eq(actionItems.clientId, userId), eq(actionItems.isCompleted, false))),

      // Recent action items (last 3 pending)
      db
        .select({
          id: actionItems.id,
          title: actionItems.title,
          dueDate: actionItems.dueDate,
          isCompleted: actionItems.isCompleted,
          coachName: users.name,
        })
        .from(actionItems)
        .leftJoin(users, eq(actionItems.coachId, users.id))
        .where(and(eq(actionItems.clientId, userId), eq(actionItems.isCompleted, false)))
        .orderBy(desc(actionItems.createdAt))
        .limit(3),

      // Completed sessions count
      db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.clientId, userId), eq(bookings.status, 'completed'))),

      // Total hours coached (sum of session durations for completed sessions)
      db
        .select({
          totalMinutes: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (${bookings.endTime} - ${bookings.startTime})) / 60), 0)`,
        })
        .from(bookings)
        .where(and(eq(bookings.clientId, userId), eq(bookings.status, 'completed'))),

      // Distinct coaches
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${bookings.coachId})` })
        .from(bookings)
        .where(
          and(
            eq(bookings.clientId, userId),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'completed'))
          )
        ),
    ]);

    const upcomingSessions = upcomingSessionsRaw.map((s) => ({
      ...s,
      clientId: userId,
      clientName: null,
      clientAvatar: null,
      clientEmail: '',
    }));

    return {
      success: true,
      data: {
        upcomingSessions,
        unreadMessageCount: unreadCount,
        recentMessages: recentMessagesData,
        pendingActionItemsCount: Number(pendingItemsResult[0]?.count || 0),
        distinctCoachCount: Number(distinctCoachesResult[0]?.count || 0),
        recentActionItems: recentItemsRaw,
        sessionHistory: {
          completedCount: Number(completedSessionsResult[0]?.count || 0),
          totalHours: Math.round((Number(totalHoursResult[0]?.totalMinutes || 0) / 60) * 10) / 10,
        },
      },
    };
  } catch (error) {
    console.error('Error fetching client dashboard data:', error);
    return { success: false, error: 'Failed to load dashboard data' };
  }
}

// ============================================================================
// Calendar Data
// ============================================================================

export async function getSessionsForMonth(
  year: number,
  month: number
): Promise<{ success: true; sessions: CalendarSession[] } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated' };

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get user role
    const userResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const role = userResult[0]?.role || 'client';
    const isCoach = role === 'coach';

    const sessionsRaw = await db
      .select({
        id: bookings.id,
        otherUserName: users.name,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
      })
      .from(bookings)
      .innerJoin(users, isCoach ? eq(bookings.clientId, users.id) : eq(bookings.coachId, users.id))
      .where(
        and(
          isCoach ? eq(bookings.coachId, userId) : eq(bookings.clientId, userId),
          gte(bookings.startTime, startDate),
          lte(bookings.startTime, endDate),
          or(
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'pending'),
            eq(bookings.status, 'completed')
          )
        )
      )
      .orderBy(asc(bookings.startTime));

    return { success: true, sessions: sessionsRaw };
  } catch (error) {
    console.error('Error fetching calendar sessions:', error);
    return { success: false, error: 'Failed to load calendar data' };
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function getUnreadCountForUser(userId: string): Promise<number> {
  const convIds = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

  if (convIds.length === 0) return 0;

  const ids = convIds.map((c) => c.id);
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, ids),
        ne(messages.senderId, userId),
        eq(messages.isRead, false)
      )
    );

  return Number(result[0]?.count || 0);
}

async function getRecentMessagesForUser(userId: string, limit: number): Promise<MessagePreview[]> {
  const convs = await db
    .select({
      id: conversations.id,
      coachId: conversations.coachId,
      clientId: conversations.clientId,
      lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit);

  if (convs.length === 0) return [];

  const convIds = convs.map((c) => c.id);
  const otherUserIds = Array.from(
    new Set(convs.map((c) => (c.coachId === userId ? c.clientId : c.coachId)))
  );

  const [usersData, lastMessages, unreadCounts] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, otherUserIds)),
    db
      .select({
        conversationId: messages.conversationId,
        content: messages.content,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${messages.conversationId} ORDER BY ${messages.createdAt} DESC)`.as(
          'rn'
        ),
      })
      .from(messages)
      .where(inArray(messages.conversationId, convIds))
      .then((rows) => rows.filter((r) => r.rn === 1)),
    db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, convIds),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        )
      )
      .groupBy(messages.conversationId),
  ]);

  const userMap = new Map(usersData.map((u) => [u.id, u]));
  const lastMsgMap = new Map(lastMessages.map((r) => [r.conversationId, r.content]));
  const unreadMap = new Map(unreadCounts.map((r) => [r.conversationId, Number(r.count)]));

  return convs.map((conv) => {
    const otherUserId = conv.coachId === userId ? conv.clientId : conv.coachId;
    const other = userMap.get(otherUserId);
    return {
      conversationId: conv.id,
      otherUserId,
      otherUserName: other?.name || null,
      otherUserAvatar: other?.avatarUrl || null,
      lastMessageContent: lastMsgMap.get(conv.id) || null,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: unreadMap.get(conv.id) || 0,
    };
  });
}
