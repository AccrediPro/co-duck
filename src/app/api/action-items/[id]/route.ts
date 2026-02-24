/**
 * @fileoverview Action Item Details API
 *
 * Get, update, and delete action items.
 *
 * @module api/action-items/[id]
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { actionItems, users } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/action-items/:id
 *
 * Returns details of a specific action item.
 *
 * @param {string} id - Action item ID
 *
 * @returns {Object} Action item details
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid action item ID' } },
        { status: 400 }
      );
    }

    // Get action item with access check
    const item = await db.query.actionItems.findFirst({
      where: and(
        eq(actionItems.id, itemId),
        or(eq(actionItems.coachId, userId), eq(actionItems.clientId, userId))
      ),
    });

    if (!item) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Action item not found' } },
        { status: 404 }
      );
    }

    // Get coach and client info
    const [coach, client] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, item.coachId) }),
      db.query.users.findFirst({ where: eq(users.id, item.clientId) }),
    ]);

    return Response.json({
      success: true,
      data: {
        id: item.id,
        title: item.title,
        description: item.description,
        dueDate: item.dueDate,
        isCompleted: item.isCompleted,
        completedAt: item.completedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        bookingId: item.bookingId,
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
      },
    });
  } catch (error) {
    console.error('Error fetching action item:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch action item' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/action-items/:id
 *
 * Updates an action item.
 * - Coach can update: title, description, dueDate
 * - Both coach and client can toggle: isCompleted
 *
 * @param {string} id - Action item ID
 * @body {string} [title] - New title (coach only)
 * @body {string} [description] - New description (coach only)
 * @body {string} [dueDate] - New due date (coach only)
 * @body {boolean} [isCompleted] - Completion status
 *
 * @returns {Object} Updated action item
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const itemId = parseInt(id);
    const body = await request.json();

    if (isNaN(itemId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid action item ID' } },
        { status: 400 }
      );
    }

    // Get action item
    const item = await db.query.actionItems.findFirst({
      where: eq(actionItems.id, itemId),
    });

    if (!item) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Action item not found' } },
        { status: 404 }
      );
    }

    // Check access
    const isCoach = item.coachId === userId;
    const isClient = item.clientId === userId;

    if (!isCoach && !isClient) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Partial<typeof item> = {};

    // Coach-only updates
    if (isCoach) {
      if (body.title !== undefined) {
        updateData.title = body.title;
      }
      if (body.description !== undefined) {
        updateData.description = body.description;
      }
      if (body.dueDate !== undefined) {
        if (body.dueDate === null) {
          updateData.dueDate = null;
        } else {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(body.dueDate)) {
            return Response.json(
              {
                success: false,
                error: { code: 'INVALID_DATE', message: 'Due date must be in YYYY-MM-DD format' },
              },
              { status: 400 }
            );
          }
          updateData.dueDate = body.dueDate;
        }
      }
    }

    // Both can toggle completion
    if (body.isCompleted !== undefined) {
      updateData.isCompleted = body.isCompleted;
      updateData.completedAt = body.isCompleted ? new Date() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    // Update action item
    const [updatedItem] = await db
      .update(actionItems)
      .set(updateData)
      .where(eq(actionItems.id, itemId))
      .returning();

    return Response.json({
      success: true,
      data: {
        id: updatedItem.id,
        title: updatedItem.title,
        description: updatedItem.description,
        dueDate: updatedItem.dueDate,
        isCompleted: updatedItem.isCompleted,
        completedAt: updatedItem.completedAt,
        updatedAt: updatedItem.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating action item:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update action item' },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/action-items/:id
 *
 * Deletes an action item (coach only).
 *
 * @param {string} id - Action item ID
 *
 * @returns {Object} Success message
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid action item ID' } },
        { status: 400 }
      );
    }

    // Get action item
    const item = await db.query.actionItems.findFirst({
      where: eq(actionItems.id, itemId),
    });

    if (!item) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Action item not found' } },
        { status: 404 }
      );
    }

    // Only coach can delete
    if (item.coachId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the coach can delete action items' },
        },
        { status: 403 }
      );
    }

    // Delete action item
    await db.delete(actionItems).where(eq(actionItems.id, itemId));

    return Response.json({
      success: true,
      data: {
        message: 'Action item deleted successfully',
      },
    });
  } catch (error) {
    console.error('Error deleting action item:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete action item' },
      },
      { status: 500 }
    );
  }
}
