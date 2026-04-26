import { auth } from '@clerk/nextjs/server';
import { db, bookings, reviews, messages, conversations, users, actionItems } from '@/db';
import { eq, and, desc, ne, inArray } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface ActivityEvent {
  type:
    | 'booking_created'
    | 'booking_confirmed'
    | 'booking_completed'
    | 'message_received'
    | 'review_received'
    | 'action_item_completed';
  description: string;
  timestamp: string;
  link: string;
}

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'activity-feed');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    const role = user?.role ?? 'client';
    const events: ActivityEvent[] = [];

    if (role === 'coach') {
      // Recent bookings for this coach
      const recentBookings = await db
        .select({
          id: bookings.id,
          status: bookings.status,
          clientName: users.name,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.clientId, users.id))
        .where(eq(bookings.coachId, userId))
        .orderBy(desc(bookings.createdAt))
        .limit(5);

      for (const b of recentBookings) {
        const statusLabel =
          b.status === 'confirmed'
            ? 'confirmed'
            : b.status === 'completed'
              ? 'completed'
              : 'created';
        events.push({
          type: `booking_${statusLabel}` as ActivityEvent['type'],
          description: `Session with ${b.clientName ?? 'a client'} ${statusLabel}`,
          timestamp: b.createdAt?.toISOString() ?? new Date().toISOString(),
          link: '/dashboard/sessions',
        });
      }

      // Recent reviews
      const recentReviews = await db
        .select({
          rating: reviews.rating,
          clientName: users.name,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.clientId, users.id))
        .where(eq(reviews.coachId, userId))
        .orderBy(desc(reviews.createdAt))
        .limit(3);

      for (const r of recentReviews) {
        events.push({
          type: 'review_received',
          description: `${r.clientName ?? 'A client'} left a ${r.rating}-star review`,
          timestamp: r.createdAt?.toISOString() ?? new Date().toISOString(),
          link: '/dashboard/profile',
        });
      }

      // Recent messages received
      const coachConvs = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.coachId, userId));

      if (coachConvs.length > 0) {
        const convIds = coachConvs.map((c) => c.id);
        const recentMsgs = await db
          .select({
            senderName: users.name,
            createdAt: messages.createdAt,
            conversationId: messages.conversationId,
          })
          .from(messages)
          .innerJoin(users, eq(messages.senderId, users.id))
          .where(and(inArray(messages.conversationId, convIds), ne(messages.senderId, userId)))
          .orderBy(desc(messages.createdAt))
          .limit(3);

        for (const m of recentMsgs) {
          events.push({
            type: 'message_received',
            description: `New message from ${m.senderName ?? 'a client'}`,
            timestamp: m.createdAt?.toISOString() ?? new Date().toISOString(),
            link: `/dashboard/messages/${m.conversationId}`,
          });
        }
      }
    } else {
      // Client: recent bookings
      const recentBookings = await db
        .select({
          id: bookings.id,
          status: bookings.status,
          coachName: users.name,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.coachId, users.id))
        .where(eq(bookings.clientId, userId))
        .orderBy(desc(bookings.createdAt))
        .limit(5);

      for (const b of recentBookings) {
        const statusLabel =
          b.status === 'confirmed'
            ? 'confirmed'
            : b.status === 'completed'
              ? 'completed'
              : 'booked';
        events.push({
          type: `booking_${statusLabel === 'booked' ? 'created' : statusLabel}` as ActivityEvent['type'],
          description: `Session with ${b.coachName ?? 'your coach'} ${statusLabel}`,
          timestamp: b.createdAt?.toISOString() ?? new Date().toISOString(),
          link: '/dashboard/my-sessions',
        });
      }

      // Recent action items completed
      const completedItems = await db
        .select({
          title: actionItems.title,
          updatedAt: actionItems.updatedAt,
        })
        .from(actionItems)
        .where(and(eq(actionItems.clientId, userId), eq(actionItems.isCompleted, true)))
        .orderBy(desc(actionItems.updatedAt))
        .limit(3);

      for (const item of completedItems) {
        events.push({
          type: 'action_item_completed',
          description: `Completed: ${item.title}`,
          timestamp: item.updatedAt?.toISOString() ?? new Date().toISOString(),
          link: '/dashboard/action-items',
        });
      }
    }

    // Sort all events by timestamp descending and take top 10
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return Response.json({
      success: true,
      data: events.slice(0, 10),
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load activity' } },
      { status: 500 }
    );
  }
}
