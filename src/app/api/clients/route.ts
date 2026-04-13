import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, programs } from '@/db/schema';
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
    // Verify user is a coach
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can view their client list' },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Get distinct clients from confirmed/completed bookings
    const clientRows = await db
      .select({
        clientId: bookings.clientId,
        lastBookingDate: sql<string>`max(${bookings.startTime})`.as('last_booking_date'),
        totalSessions: sql<number>`count(*)`.as('total_sessions'),
      })
      .from(bookings)
      .where(
        and(eq(bookings.coachId, userId), inArray(bookings.status, ['confirmed', 'completed']))
      )
      .groupBy(bookings.clientId)
      .orderBy(desc(sql`max(${bookings.startTime})`));

    const total = clientRows.length;
    const paginatedRows = clientRows.slice(offset, offset + limit);

    if (paginatedRows.length === 0) {
      return Response.json({
        success: true,
        data: {
          clients: [],
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    }

    // Get user info for clients
    const clientIds = paginatedRows.map((r) => r.clientId);
    const clientUsers = await db.select().from(users).where(inArray(users.id, clientIds));
    const clientsMap = new Map(clientUsers.map((u) => [u.id, u]));

    // Get active programs count per client
    const programCounts = await db
      .select({
        clientId: programs.clientId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(programs)
      .where(
        and(
          eq(programs.coachId, userId),
          inArray(programs.clientId, clientIds),
          eq(programs.status, 'active')
        )
      )
      .groupBy(programs.clientId);
    const programsMap = new Map(programCounts.map((p) => [p.clientId, Number(p.count)]));

    const formattedClients = paginatedRows.map((row) => {
      const client = clientsMap.get(row.clientId);
      return {
        id: row.clientId,
        name: client?.name || null,
        email: client?.email || null,
        avatarUrl: client?.avatarUrl || null,
        lastBookingDate: row.lastBookingDate,
        totalSessions: Number(row.totalSessions),
        activeProgramsCount: programsMap.get(row.clientId) || 0,
      };
    });

    return Response.json({
      success: true,
      data: {
        clients: formattedClients,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch clients' } },
      { status: 500 }
    );
  }
}
