import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, coachProfiles, programs } from '@/db/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Get distinct coaches from confirmed/completed bookings
    const coachRows = await db
      .select({
        coachId: bookings.coachId,
        lastBookingDate: sql<string>`max(${bookings.startTime})`.as('last_booking_date'),
        totalSessions: sql<number>`count(*)`.as('total_sessions'),
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.clientId, userId),
          inArray(bookings.status, ['confirmed', 'completed'])
        )
      )
      .groupBy(bookings.coachId)
      .orderBy(desc(sql`max(${bookings.startTime})`));

    const total = coachRows.length;
    const paginatedRows = coachRows.slice(offset, offset + limit);

    if (paginatedRows.length === 0) {
      return Response.json({
        success: true,
        data: {
          coaches: [],
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    }

    // Get user info and coach profiles
    const coachIds = paginatedRows.map((r) => r.coachId);
    const [coachUsers, coachProfilesData, programCounts] = await Promise.all([
      db.select().from(users).where(inArray(users.id, coachIds)),
      db.select().from(coachProfiles).where(inArray(coachProfiles.userId, coachIds)),
      db
        .select({
          coachId: programs.coachId,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(programs)
        .where(
          and(
            eq(programs.clientId, userId),
            inArray(programs.coachId, coachIds),
            eq(programs.status, 'active')
          )
        )
        .groupBy(programs.coachId),
    ]);

    const coachUsersMap = new Map(coachUsers.map((u) => [u.id, u]));
    const coachProfilesMap = new Map(coachProfilesData.map((p) => [p.userId, p]));
    const programsMap = new Map(programCounts.map((p) => [p.coachId, Number(p.count)]));

    const formattedCoaches = paginatedRows.map((row) => {
      const coach = coachUsersMap.get(row.coachId);
      const profile = coachProfilesMap.get(row.coachId);
      return {
        id: row.coachId,
        name: coach?.name || null,
        email: coach?.email || null,
        avatarUrl: coach?.avatarUrl || null,
        profile: profile
          ? {
              headline: profile.headline,
              slug: profile.slug,
              specialties: profile.specialties,
            }
          : null,
        lastBookingDate: row.lastBookingDate,
        totalSessions: Number(row.totalSessions),
        activeProgramsCount: programsMap.get(row.coachId) || 0,
      };
    });

    return Response.json({
      success: true,
      data: {
        coaches: formattedCoaches,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching coaches:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coaches' } },
      { status: 500 }
    );
  }
}
