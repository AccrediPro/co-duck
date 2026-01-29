'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, desc, asc } from 'drizzle-orm';
import { db, actionItems, bookings, users } from '@/db';
import type { ActionItem } from '@/db/schema';
import { revalidatePath } from 'next/cache';

// Type for action item with computed status
export interface ActionItemWithStatus {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  status: 'pending' | 'overdue' | 'completed';
  bookingId: number | null;
}

// Helper to compute status
function computeStatus(item: ActionItem): 'pending' | 'overdue' | 'completed' {
  if (item.isCompleted) {
    return 'completed';
  }

  if (item.dueDate) {
    const due = new Date(item.dueDate);
    // Set due date to end of day for comparison
    due.setHours(23, 59, 59, 999);
    if (due < new Date()) {
      return 'overdue';
    }
  }

  return 'pending';
}

// Create action item result
export interface CreateActionItemResult {
  success: boolean;
  actionItem?: ActionItemWithStatus;
  error?: string;
}

// Create a new action item
export async function createActionItem(data: {
  clientId: string;
  bookingId?: number | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
}): Promise<CreateActionItemResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate required fields
  const trimmedTitle = data.title?.trim();
  if (!trimmedTitle) {
    return { success: false, error: 'Title is required' };
  }

  try {
    // If bookingId is provided, verify it belongs to this coach and client
    if (data.bookingId) {
      const bookingResult = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, data.bookingId),
            eq(bookings.coachId, userId),
            eq(bookings.clientId, data.clientId)
          )
        )
        .limit(1);

      if (bookingResult.length === 0) {
        return { success: false, error: 'Invalid booking' };
      }
    }

    // Create the action item
    const result = await db
      .insert(actionItems)
      .values({
        coachId: userId,
        clientId: data.clientId,
        bookingId: data.bookingId || null,
        title: trimmedTitle,
        description: data.description?.trim() || null,
        dueDate: data.dueDate || null,
        isCompleted: false,
      })
      .returning();

    const created = result[0];

    // Revalidate paths
    revalidatePath('/dashboard/sessions');
    revalidatePath('/dashboard/messages');

    return {
      success: true,
      actionItem: {
        id: created.id,
        title: created.title,
        description: created.description,
        dueDate: created.dueDate,
        isCompleted: created.isCompleted,
        completedAt: created.completedAt,
        createdAt: created.createdAt,
        status: computeStatus(created),
        bookingId: created.bookingId,
      },
    };
  } catch (error) {
    console.error('Error creating action item:', error);
    return { success: false, error: 'Failed to create action item' };
  }
}

// Get action items result
export interface GetClientActionItemsResult {
  success: boolean;
  actionItems?: ActionItemWithStatus[];
  error?: string;
}

// Get all action items for a client (coach view)
export async function getClientActionItems(clientId: string): Promise<GetClientActionItemsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const items = await db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.coachId, userId), eq(actionItems.clientId, clientId)))
      .orderBy(
        asc(actionItems.isCompleted), // Pending first
        desc(actionItems.createdAt) // Newest first
      );

    const itemsWithStatus: ActionItemWithStatus[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      status: computeStatus(item),
      bookingId: item.bookingId,
    }));

    return {
      success: true,
      actionItems: itemsWithStatus,
    };
  } catch (error) {
    console.error('Error fetching action items:', error);
    return { success: false, error: 'Failed to fetch action items' };
  }
}

// Mark complete result
export interface MarkActionItemCompleteResult {
  success: boolean;
  error?: string;
}

// Mark an action item as complete (coach or client can do this)
export async function markActionItemComplete(
  actionItemId: number,
  completed: boolean = true
): Promise<MarkActionItemCompleteResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the action item belongs to this coach or client
    const existingItem = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.id, actionItemId))
      .limit(1);

    if (existingItem.length === 0) {
      return { success: false, error: 'Action item not found' };
    }

    const item = existingItem[0];

    // Only the coach or client can update
    if (item.coachId !== userId && item.clientId !== userId) {
      return { success: false, error: 'Not authorized' };
    }

    // Update the item
    await db
      .update(actionItems)
      .set({
        isCompleted: completed,
        completedAt: completed ? new Date() : null,
      })
      .where(eq(actionItems.id, actionItemId));

    // Revalidate paths
    revalidatePath('/dashboard/sessions');
    revalidatePath('/dashboard/messages');
    revalidatePath('/dashboard/action-items');

    return { success: true };
  } catch (error) {
    console.error('Error updating action item:', error);
    return { success: false, error: 'Failed to update action item' };
  }
}

// Delete result
export interface DeleteActionItemResult {
  success: boolean;
  error?: string;
}

// Delete an action item (coach only)
export async function deleteActionItem(actionItemId: number): Promise<DeleteActionItemResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the action item belongs to this coach
    const existingItem = await db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.id, actionItemId), eq(actionItems.coachId, userId)))
      .limit(1);

    if (existingItem.length === 0) {
      return { success: false, error: 'Action item not found' };
    }

    // Delete the item
    await db.delete(actionItems).where(eq(actionItems.id, actionItemId));

    // Revalidate paths
    revalidatePath('/dashboard/sessions');
    revalidatePath('/dashboard/messages');
    revalidatePath('/dashboard/action-items');

    return { success: true };
  } catch (error) {
    console.error('Error deleting action item:', error);
    return { success: false, error: 'Failed to delete action item' };
  }
}

// Get action items for a specific session/booking
export async function getSessionActionItems(
  bookingId: number
): Promise<GetClientActionItemsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the booking belongs to this coach
    const bookingResult = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)))
      .limit(1);

    if (bookingResult.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const items = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.bookingId, bookingId))
      .orderBy(asc(actionItems.isCompleted), desc(actionItems.createdAt));

    const itemsWithStatus: ActionItemWithStatus[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      status: computeStatus(item),
      bookingId: item.bookingId,
    }));

    return {
      success: true,
      actionItems: itemsWithStatus,
    };
  } catch (error) {
    console.error('Error fetching session action items:', error);
    return { success: false, error: 'Failed to fetch action items' };
  }
}

// Extended type for client view with coach info
export interface ActionItemWithCoach extends ActionItemWithStatus {
  coachId: string;
  coachName: string | null;
  coachAvatar: string | null;
}

// Result for client's action items
export interface GetMyActionItemsResult {
  success: boolean;
  actionItems?: ActionItemWithCoach[];
  error?: string;
}

// Get all action items for the current user as a client
export async function getMyActionItems(
  filter: 'all' | 'pending' | 'completed' = 'all'
): Promise<GetMyActionItemsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Build query conditions
    const conditions = [eq(actionItems.clientId, userId)];

    if (filter === 'pending') {
      conditions.push(eq(actionItems.isCompleted, false));
    } else if (filter === 'completed') {
      conditions.push(eq(actionItems.isCompleted, true));
    }

    const items = await db
      .select({
        id: actionItems.id,
        coachId: actionItems.coachId,
        title: actionItems.title,
        description: actionItems.description,
        dueDate: actionItems.dueDate,
        isCompleted: actionItems.isCompleted,
        completedAt: actionItems.completedAt,
        createdAt: actionItems.createdAt,
        bookingId: actionItems.bookingId,
        coachName: users.name,
        coachAvatar: users.avatarUrl,
      })
      .from(actionItems)
      .leftJoin(users, eq(actionItems.coachId, users.id))
      .where(and(...conditions))
      .orderBy(
        asc(actionItems.isCompleted), // Pending first
        desc(actionItems.createdAt) // Newest first
      );

    const itemsWithCoach: ActionItemWithCoach[] = items.map((item) => ({
      id: item.id,
      coachId: item.coachId,
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      isCompleted: item.isCompleted,
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      status: computeStatus({
        ...item,
        clientId: userId,
        updatedAt: item.createdAt,
      }),
      bookingId: item.bookingId,
      coachName: item.coachName,
      coachAvatar: item.coachAvatar,
    }));

    return {
      success: true,
      actionItems: itemsWithCoach,
    };
  } catch (error) {
    console.error('Error fetching my action items:', error);
    return { success: false, error: 'Failed to fetch action items' };
  }
}

// Result for pending count
export interface GetPendingActionItemsCountResult {
  success: boolean;
  count?: number;
  error?: string;
}

// Get count of pending action items for the current user as a client
export async function getPendingActionItemsCount(): Promise<GetPendingActionItemsCountResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const items = await db
      .select({ id: actionItems.id })
      .from(actionItems)
      .where(and(eq(actionItems.clientId, userId), eq(actionItems.isCompleted, false)));

    return {
      success: true,
      count: items.length,
    };
  } catch (error) {
    console.error('Error fetching pending action items count:', error);
    return { success: false, error: 'Failed to fetch count' };
  }
}
