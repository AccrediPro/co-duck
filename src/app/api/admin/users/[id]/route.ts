import { db } from '@/db';
import { users, bookings, messages, reviews, actionItems } from '@/db/schema';
import { eq, sql, or } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'admin-user-detail');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  const { id } = await params;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        coachProfile: {
          columns: {
            slug: true,
            headline: true,
            verificationStatus: true,
            isPublished: true,
            averageRating: true,
            reviewCount: true,
          },
        },
      },
    });

    if (!user) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    const [
      bookingsAsCoach,
      bookingsAsClient,
      messageCount,
      reviewsGiven,
      reviewsReceived,
      actionItemCount,
    ] = await Promise.all([
      db
        .select({
          status: bookings.status,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(eq(bookings.coachId, id))
        .groupBy(bookings.status),
      db
        .select({
          status: bookings.status,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(eq(bookings.clientId, id))
        .groupBy(bookings.status),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(eq(messages.senderId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.clientId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.coachId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(actionItems)
        .where(or(eq(actionItems.coachId, id), eq(actionItems.clientId, id))),
    ]);

    const statusMap = (rows: { status: string; count: number }[]) => {
      const map: Record<string, number> = {};
      for (const row of rows) {
        map[row.status] = row.count;
      }
      return map;
    };

    return Response.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          timezone: user.timezone,
          createdAt: user.createdAt,
          coachProfile: user.coachProfile || null,
        },
        activity: {
          bookingsAsCoach: statusMap(bookingsAsCoach),
          bookingsAsClient: statusMap(bookingsAsClient),
          messagesSent: messageCount[0]?.count ?? 0,
          reviewsGiven: reviewsGiven[0]?.count ?? 0,
          reviewsReceived: reviewsReceived[0]?.count ?? 0,
          actionItems: actionItemCount[0]?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin user detail:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user details' } },
      { status: 500 }
    );
  }
}
