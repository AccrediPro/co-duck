/**
 * @fileoverview Admin Authentication Helper
 *
 * Verifies that the authenticated user has admin role.
 * Used by all admin API routes.
 *
 * @module lib/admin-auth
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface AdminAuthResult {
  authorized: boolean;
  userId: string | null;
  response?: Response;
}

/**
 * Checks that the current user is authenticated and has admin role.
 * Returns a pre-built error response if not authorized.
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      authorized: false,
      userId: null,
      response: Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      ),
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || user.role !== 'admin') {
    return {
      authorized: false,
      userId,
      response: Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, userId };
}
