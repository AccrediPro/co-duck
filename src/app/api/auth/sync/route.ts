/**
 * @fileoverview Sync Clerk User to Database API
 *
 * Creates/updates user record in database from Clerk auth data.
 * Called by mobile app after Clerk signup to ensure user exists in DB.
 *
 * @module api/auth/sync
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/sync
 *
 * Syncs the current Clerk user to the database.
 * Creates user if not exists, updates if exists.
 *
 * @returns {Object} Synced user data
 *
 * @example Response
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_xxx",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "avatarUrl": "https://...",
 *     "role": "client",
 *     "isNew": true
 *   }
 * }
 */
export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Get full user data from Clerk
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return Response.json(
        { success: false, error: { code: 'CLERK_ERROR', message: 'Could not fetch Clerk user' } },
        { status: 500 }
      );
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return Response.json(
        { success: false, error: { code: 'NO_EMAIL', message: 'User has no email address' } },
        { status: 400 }
      );
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (existingUser) {
      // Update existing user
      await db
        .update(users)
        .set({
          email,
          name,
          avatarUrl: clerkUser.imageUrl || null,
        })
        .where(eq(users.id, userId));

      return Response.json({
        success: true,
        data: {
          id: userId,
          email,
          name,
          avatarUrl: clerkUser.imageUrl || null,
          role: existingUser.role,
          isNew: false,
        },
      });
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        name,
        avatarUrl: clerkUser.imageUrl || null,
        role: 'client',
      })
      .returning();

    return Response.json({
      success: true,
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
        isNew: true,
      },
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync user' } },
      { status: 500 }
    );
  }
}
