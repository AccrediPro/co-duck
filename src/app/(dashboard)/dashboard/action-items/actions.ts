/**
 * @fileoverview Action Items Server Actions
 *
 * This module provides server actions for managing action items (tasks) that
 * coaches assign to clients. Action items can be standalone or linked to a
 * specific booking/session.
 *
 * ## Features
 *
 * - CRUD operations for action items
 * - Status computation (pending, overdue, completed)
 * - Filtering by status and association
 * - Coach and client views with appropriate permissions
 *
 * ## Permission Model
 *
 * | Action                | Coach | Client | Notes                           |
 * |-----------------------|-------|--------|----------------------------------|
 * | createActionItem      | ✓     | ✗      | Coach creates for their clients |
 * | getClientActionItems  | ✓     | ✗      | Coach views their clients' items |
 * | markActionItemComplete| ✓     | ✓      | Both can mark complete           |
 * | deleteActionItem      | ✓     | ✗      | Only coach can delete            |
 * | getMyActionItems      | ✗     | ✓      | Client views their own items     |
 *
 * ## Status Computation
 *
 * | Status    | Condition                          |
 * |-----------|------------------------------------|
 * | completed | `isCompleted === true`             |
 * | overdue   | Due date passed, not completed     |
 * | pending   | Not completed, not overdue         |
 *
 * @module app/(dashboard)/dashboard/action-items/actions
 * @see {@link ActionItemWithStatus} - Action item with computed status
 * @see {@link ActionItemWithCoach} - Action item with coach info (client view)
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, desc, asc } from 'drizzle-orm';
import { db, actionItems, bookings, users } from '@/db';
import type { ActionItem } from '@/db/schema';
import { revalidatePath } from 'next/cache';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Action item with computed status field.
 *
 * Extends the base action item data with a computed `status` field that
 * indicates whether the item is pending, overdue, or completed. This type
 * is used in all action item responses.
 *
 * @example
 * ```ts
 * const item: ActionItemWithStatus = {
 *   id: 1,
 *   title: "Review session notes",
 *   description: "Go over the notes from our last session",
 *   dueDate: "2026-02-15",
 *   isCompleted: false,
 *   completedAt: null,
 *   createdAt: new Date("2026-01-31"),
 *   status: "pending", // Computed based on dueDate and isCompleted
 *   bookingId: 42,
 * };
 * ```
 */
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Computes the display status of an action item.
 *
 * Status determination logic:
 * 1. If `isCompleted` is true → "completed"
 * 2. If has due date and due date has passed → "overdue"
 * 3. Otherwise → "pending"
 *
 * Note: Due date comparison is done at end of day (23:59:59.999) to ensure
 * items are not marked overdue until the day has fully passed.
 *
 * @param item - The action item record from the database
 * @returns The computed status: 'pending', 'overdue', or 'completed'
 *
 * @example
 * ```ts
 * // Item with past due date
 * computeStatus({ isCompleted: false, dueDate: "2026-01-01", ... })
 * // Returns: "overdue"
 *
 * // Completed item (dueDate ignored)
 * computeStatus({ isCompleted: true, dueDate: "2026-01-01", ... })
 * // Returns: "completed"
 * ```
 */
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

// ============================================================================
// CREATE ACTION ITEM
// ============================================================================

/**
 * Result type for createActionItem server action.
 *
 * @property success - Whether the operation succeeded
 * @property actionItem - The created action item (on success)
 * @property error - Error message (on failure)
 */
export interface CreateActionItemResult {
  success: boolean;
  actionItem?: ActionItemWithStatus;
  error?: string;
}

/**
 * Creates a new action item for a client.
 *
 * Only coaches can create action items. The action item can optionally be
 * linked to a specific booking/session. When linked, the booking must belong
 * to both the coach and the specified client.
 *
 * @param data - The action item data
 * @param data.clientId - The client's user ID
 * @param data.bookingId - Optional booking ID to link the action item to
 * @param data.title - The action item title (required, trimmed)
 * @param data.description - Optional description
 * @param data.dueDate - Optional due date (ISO string format)
 * @returns Result with created action item or error
 *
 * @throws Returns error result if:
 * - User is not authenticated
 * - Title is empty after trimming
 * - Booking ID is provided but doesn't exist or doesn't belong to coach/client
 *
 * @example
 * ```ts
 * const result = await createActionItem({
 *   clientId: "user_abc123",
 *   bookingId: 42,
 *   title: "Practice breathing exercises",
 *   description: "5 minutes daily before bed",
 *   dueDate: "2026-02-15",
 * });
 *
 * if (result.success) {
 *   console.log("Created:", result.actionItem?.id);
 * }
 * ```
 */
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

// ============================================================================
// GET ACTION ITEMS (COACH VIEW)
// ============================================================================

/**
 * Result type for getClientActionItems server action.
 *
 * @property success - Whether the operation succeeded
 * @property actionItems - Array of action items (on success)
 * @property error - Error message (on failure)
 */
export interface GetClientActionItemsResult {
  success: boolean;
  actionItems?: ActionItemWithStatus[];
  error?: string;
}

/**
 * Gets all action items for a specific client (coach view).
 *
 * Returns all action items that the authenticated coach has created for
 * the specified client. Results are sorted with pending items first,
 * then by creation date (newest first).
 *
 * @param clientId - The client's user ID
 * @returns Result with array of action items or error
 *
 * @example
 * ```ts
 * const result = await getClientActionItems("user_abc123");
 * if (result.success) {
 *   result.actionItems?.forEach(item => {
 *     console.log(`${item.title}: ${item.status}`);
 *   });
 * }
 * ```
 */
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

// ============================================================================
// MARK ACTION ITEM COMPLETE
// ============================================================================

/**
 * Result type for markActionItemComplete server action.
 *
 * @property success - Whether the operation succeeded
 * @property error - Error message (on failure)
 */
export interface MarkActionItemCompleteResult {
  success: boolean;
  error?: string;
}

/**
 * Marks an action item as complete or incomplete.
 *
 * Both coaches and clients can mark action items complete. The user must
 * be either the coach who created the item or the client it was assigned to.
 *
 * When marking complete:
 * - Sets `isCompleted` to true
 * - Records `completedAt` timestamp
 *
 * When marking incomplete:
 * - Sets `isCompleted` to false
 * - Clears `completedAt` to null
 *
 * @param actionItemId - The action item ID to update
 * @param completed - Whether to mark as complete (default: true)
 * @returns Result indicating success or error
 *
 * @example
 * ```ts
 * // Mark as complete
 * await markActionItemComplete(42);
 *
 * // Mark as incomplete (undo completion)
 * await markActionItemComplete(42, false);
 * ```
 */
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

// ============================================================================
// DELETE ACTION ITEM
// ============================================================================

/**
 * Result type for deleteActionItem server action.
 *
 * @property success - Whether the operation succeeded
 * @property error - Error message (on failure)
 */
export interface DeleteActionItemResult {
  success: boolean;
  error?: string;
}

/**
 * Deletes an action item.
 *
 * Only the coach who created the action item can delete it. Clients cannot
 * delete action items assigned to them.
 *
 * @param actionItemId - The action item ID to delete
 * @returns Result indicating success or error
 *
 * @example
 * ```ts
 * const result = await deleteActionItem(42);
 * if (result.success) {
 *   console.log("Action item deleted");
 * }
 * ```
 */
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

// ============================================================================
// GET SESSION ACTION ITEMS
// ============================================================================

/**
 * Gets action items linked to a specific session/booking.
 *
 * Returns all action items that are associated with the specified booking.
 * Only the coach who owns the booking can access these action items.
 *
 * @param bookingId - The booking ID to get action items for
 * @returns Result with array of action items or error
 *
 * @example
 * ```ts
 * const result = await getSessionActionItems(42);
 * if (result.success) {
 *   console.log(`Session has ${result.actionItems?.length} action items`);
 * }
 * ```
 */
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

// ============================================================================
// GET ACTION ITEMS (CLIENT VIEW)
// ============================================================================

/**
 * Extended action item type for client view that includes coach information.
 *
 * When clients view their action items, they need to see which coach
 * assigned each item. This type extends ActionItemWithStatus with coach details.
 *
 * @example
 * ```ts
 * const item: ActionItemWithCoach = {
 *   ...baseActionItem,
 *   coachId: "user_coach123",
 *   coachName: "Jane Smith",
 *   coachAvatar: "https://example.com/avatar.jpg",
 * };
 * ```
 */
export interface ActionItemWithCoach extends ActionItemWithStatus {
  coachId: string;
  coachName: string | null;
  coachAvatar: string | null;
}

/**
 * Result type for getMyActionItems server action.
 *
 * @property success - Whether the operation succeeded
 * @property actionItems - Array of action items with coach info (on success)
 * @property error - Error message (on failure)
 */
export interface GetMyActionItemsResult {
  success: boolean;
  actionItems?: ActionItemWithCoach[];
  error?: string;
}

/**
 * Gets all action items assigned to the current user (client view).
 *
 * Returns action items from all coaches, with optional filtering by status.
 * Results include coach information (name, avatar) for each item.
 *
 * Results are sorted with pending items first, then by creation date (newest first).
 *
 * @param filter - Filter by status: 'all', 'pending', or 'completed' (default: 'all')
 * @returns Result with array of action items including coach info
 *
 * @example
 * ```ts
 * // Get all action items
 * const all = await getMyActionItems('all');
 *
 * // Get only pending items
 * const pending = await getMyActionItems('pending');
 *
 * // Get completed items
 * const completed = await getMyActionItems('completed');
 * ```
 */
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
        goalId: null,
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

// ============================================================================
// GET PENDING COUNT
// ============================================================================

/**
 * Result type for getPendingActionItemsCount server action.
 *
 * @property success - Whether the operation succeeded
 * @property count - Number of pending action items (on success)
 * @property error - Error message (on failure)
 */
export interface GetPendingActionItemsCountResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Gets the count of pending (incomplete) action items for the current user.
 *
 * This is a lightweight server action used by the dashboard to display the
 * pending action items count without fetching all item details.
 *
 * Note: This counts items where `isCompleted === false`. It does not
 * distinguish between "pending" and "overdue" items - both are counted.
 *
 * @returns Result with pending item count or error
 *
 * @example
 * ```ts
 * // Used in dashboard page.tsx during SSR
 * const result = await getPendingActionItemsCount();
 * const count = result.success ? result.count || 0 : 0;
 * ```
 */
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
