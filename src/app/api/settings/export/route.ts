/**
 * @fileoverview GDPR Data Export API
 *
 * Exports all user data as a JSON file for GDPR compliance.
 * Includes profile, bookings, transactions, messages, reviews, action items, and notifications.
 *
 * @module api/settings/export
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import {
  users,
  coachProfiles,
  bookings,
  transactions,
  conversations,
  messages,
  actionItems,
  reviews,
  sessionNotes,
  notifications,
} from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const EXPORT_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }; // 3 exports per hour

/**
 * GET /api/settings/export
 *
 * Export all user data as a downloadable JSON file (GDPR Article 20).
 * Rate limited to 3 requests per hour.
 *
 * @returns JSON file download with all user data
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, EXPORT_LIMIT, 'data-export');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Fetch all user data in parallel
    const [
      userData,
      coachProfile,
      userBookings,
      userTransactions,
      userConversations,
      userActionItems,
      userReviews,
      userSessionNotes,
      userNotifications,
    ] = await Promise.all([
      // Profile
      db.query.users.findFirst({ where: eq(users.id, userId) }),

      // Coach profile (if applicable)
      db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, userId) }),

      // Bookings (as coach or client)
      db
        .select()
        .from(bookings)
        .where(or(eq(bookings.coachId, userId), eq(bookings.clientId, userId))),

      // Transactions (as coach or client)
      db
        .select()
        .from(transactions)
        .where(or(eq(transactions.coachId, userId), eq(transactions.clientId, userId))),

      // Conversations + messages
      db
        .select()
        .from(conversations)
        .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))),

      // Action items
      db
        .select()
        .from(actionItems)
        .where(or(eq(actionItems.coachId, userId), eq(actionItems.clientId, userId))),

      // Reviews (written by or about user)
      db
        .select()
        .from(reviews)
        .where(or(eq(reviews.coachId, userId), eq(reviews.clientId, userId))),

      // Session notes (coach only)
      db.select().from(sessionNotes).where(eq(sessionNotes.coachId, userId)),

      // Notifications
      db.select().from(notifications).where(eq(notifications.userId, userId)),
    ]);

    if (!userData) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Fetch messages for all conversations
    const conversationIds = userConversations.map((c) => c.id);
    let userMessages: Array<Record<string, unknown>> = [];
    if (conversationIds.length > 0) {
      const allMessages = await Promise.all(
        conversationIds.map((convId) =>
          db.select().from(messages).where(eq(messages.conversationId, convId))
        )
      );
      userMessages = allMessages.flat();
    }

    // Build export object
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
        role: userData.role,
        phone: userData.phone,
        timezone: userData.timezone,
        emailPreferences: userData.emailPreferences,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      },
      coachProfile: coachProfile
        ? {
            slug: coachProfile.slug,
            headline: coachProfile.headline,
            bio: coachProfile.bio,
            specialties: coachProfile.specialties,
            sessionTypes: coachProfile.sessionTypes,
            hourlyRate: coachProfile.hourlyRate,
            currency: coachProfile.currency,
            averageRating: coachProfile.averageRating,
            reviewCount: coachProfile.reviewCount,
            verificationStatus: coachProfile.verificationStatus,
            isPublished: coachProfile.isPublished,
            createdAt: coachProfile.createdAt,
            updatedAt: coachProfile.updatedAt,
          }
        : null,
      bookings: userBookings.map((b) => ({
        id: b.id,
        role: b.coachId === userId ? 'coach' : 'client',
        sessionType: b.sessionType,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        clientNotes: b.clientNotes,
        meetingLink: b.meetingLink,
        cancelledAt: b.cancelledAt,
        cancellationReason: b.cancellationReason,
        createdAt: b.createdAt,
      })),
      transactions: userTransactions.map((t) => ({
        id: t.id,
        bookingId: t.bookingId,
        role: t.coachId === userId ? 'coach' : 'client',
        amountCents: t.amountCents,
        currency: t.currency,
        platformFeeCents: t.platformFeeCents,
        coachPayoutCents: t.coachPayoutCents,
        status: t.status,
        createdAt: t.createdAt,
      })),
      conversations: userConversations.map((c) => ({
        id: c.id,
        role: c.coachId === userId ? 'coach' : 'client',
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
      })),
      messages: userMessages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        isSender: m.senderId === userId,
        content: m.content,
        messageType: m.messageType,
        createdAt: m.createdAt,
      })),
      actionItems: userActionItems.map((a) => ({
        id: a.id,
        role: a.coachId === userId ? 'coach' : 'client',
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        isCompleted: a.isCompleted,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
      })),
      reviews: userReviews.map((r) => ({
        id: r.id,
        role: r.coachId === userId ? 'coach' : 'client',
        bookingId: r.bookingId,
        rating: r.rating,
        title: r.title,
        content: r.content,
        coachResponse: r.coachResponse,
        isPublic: r.isPublic,
        createdAt: r.createdAt,
      })),
      sessionNotes: userSessionNotes.map((n) => ({
        id: n.id,
        bookingId: n.bookingId,
        content: n.content,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      notifications: userNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="co-duck-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export data' } },
      { status: 500 }
    );
  }
}
