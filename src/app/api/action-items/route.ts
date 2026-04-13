/**
 * @fileoverview Action Items API
 *
 * List and create action items for the authenticated user.
 *
 * @module api/action-items
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { actionItems, users } from '@/db/schema';
import { eq, or, desc, and, inArray, sql } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';
import { ActionItemEmail } from '@/lib/emails';
import { sendEmailWithPreferences } from '@/lib/emails/send-with-preferences';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { formatDateLong } from '@/lib/date-utils';

/**
 * GET /api/action-items
 *
 * Returns action items for the authenticated user.
 *
 * @query {string} [status] - Filter: "pending", "completed", or "all" (default: all)
 * @query {string} [role] - Filter by role: "coach" (assigned by me), "client" (assigned to me)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 *
 * @returns {Object} Paginated action items
 */
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
    const status = searchParams.get('status') || 'all';
    const role = searchParams.get('role');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    // Role filter
    if (role === 'coach') {
      conditions.push(eq(actionItems.coachId, userId));
    } else if (role === 'client') {
      conditions.push(eq(actionItems.clientId, userId));
    } else {
      conditions.push(or(eq(actionItems.coachId, userId), eq(actionItems.clientId, userId)));
    }

    // Status filter
    if (status === 'pending') {
      conditions.push(eq(actionItems.isCompleted, false));
    } else if (status === 'completed') {
      conditions.push(eq(actionItems.isCompleted, true));
    }

    // Get total count and paginated items in parallel
    const [countResult, paginatedItems] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(actionItems)
        .where(and(...conditions)),
      db
        .select()
        .from(actionItems)
        .where(and(...conditions))
        .orderBy(desc(actionItems.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Get user info
    const userIds = Array.from(new Set(paginatedItems.flatMap((i) => [i.coachId, i.clientId])));
    const usersData = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    // Format response
    const formattedItems = paginatedItems.map((item) => {
      const coach = usersMap.get(item.coachId);
      const client = usersMap.get(item.clientId);

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        dueDate: item.dueDate,
        isCompleted: item.isCompleted,
        completedAt: item.completedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        bookingId: item.bookingId,
        goalId: item.goalId,
        coach: coach
          ? {
              id: coach.id,
              name: coach.name,
              avatarUrl: coach.avatarUrl,
            }
          : null,
        client: client
          ? {
              id: client.id,
              name: client.name,
              avatarUrl: client.avatarUrl,
            }
          : null,
        isCoach: item.coachId === userId,
      };
    });

    return Response.json({
      success: true,
      data: {
        actionItems: formattedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching action items:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch action items' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/action-items
 *
 * Creates a new action item (coach only).
 *
 * @body {string} clientId - Client's user ID
 * @body {string} title - Task title
 * @body {string} [description] - Task description
 * @body {string} [dueDate] - Due date (YYYY-MM-DD)
 * @body {number} [bookingId] - Associated booking ID
 *
 * @returns {Object} Created action item
 */
export async function POST(request: Request) {
  // Rate limit: 10 requests per minute
  const rl = rateLimit(request, WRITE_LIMIT, 'action-items-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { clientId, title, description, dueDate, bookingId } = body;

    // Validate required fields
    if (!clientId || !title) {
      return Response.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'clientId and title are required' },
        },
        { status: 400 }
      );
    }

    // Verify user is a coach
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can create action items' },
        },
        { status: 403 }
      );
    }

    // Verify client exists
    const client = await db.query.users.findFirst({
      where: eq(users.id, clientId),
    });

    if (!client) {
      return Response.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    // Validate due date if provided
    let parsedDueDate: string | null = null;
    if (dueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate)) {
        return Response.json(
          {
            success: false,
            error: { code: 'INVALID_DATE', message: 'Due date must be in YYYY-MM-DD format' },
          },
          { status: 400 }
        );
      }
      parsedDueDate = dueDate;
    }

    // Create action item
    const [newItem] = await db
      .insert(actionItems)
      .values({
        coachId: userId,
        clientId,
        title,
        description: description || null,
        dueDate: parsedDueDate,
        bookingId: bookingId || null,
        isCompleted: false,
      })
      .returning();

    // Notify the client about the new action item
    createNotification({
      userId: clientId,
      type: 'action_item',
      title: 'New action item assigned',
      body: title,
      link: '/dashboard/action-items',
    });

    // Send action item email to client (preference-checked, non-blocking)
    if (client.email) {
      sendEmailWithPreferences(
        clientId,
        'bookings',
        client.email,
        `New action item from ${currentUser.name || 'your coach'}: ${title}`,
        ActionItemEmail({
          clientName: client.name || 'there',
          coachName: currentUser.name || 'Your Coach',
          title,
          description: description || undefined,
          dueDate: parsedDueDate ? formatDateLong(parsedDueDate) : undefined,
          unsubscribeUrl: getUnsubscribeUrl(clientId, 'bookings'),
        })
      ).catch((err) => console.error('Failed to send action item email:', err));
    }

    return Response.json({
      success: true,
      data: {
        id: newItem.id,
        title: newItem.title,
        description: newItem.description,
        dueDate: newItem.dueDate,
        isCompleted: newItem.isCompleted,
        createdAt: newItem.createdAt,
        bookingId: newItem.bookingId,
      },
    });
  } catch (error) {
    console.error('Error creating action item:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create action item' },
      },
      { status: 500 }
    );
  }
}
