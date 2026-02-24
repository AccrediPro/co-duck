/**
 * @fileoverview User Preferences API
 *
 * Get and update user preferences (timezone, email notifications).
 *
 * @module api/settings/preferences
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const emailPreferencesSchema = z.object({
  bookings: z.boolean().optional(),
  messages: z.boolean().optional(),
  reviews: z.boolean().optional(),
  reminders: z.boolean().optional(),
  marketing: z.boolean().optional(),
});

const updatePreferencesSchema = z.object({
  timezone: z.string().max(100).optional(),
  emailPreferences: emailPreferencesSchema.optional(),
});

/**
 * GET /api/settings/preferences
 *
 * Returns the current user's timezone and email preferences.
 */
export async function GET() {
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
    });

    if (!user) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        timezone: user.timezone || null,
        emailPreferences: user.emailPreferences || {
          bookings: true,
          messages: true,
          reviews: true,
          reminders: true,
          marketing: false,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch preferences' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/preferences
 *
 * Update timezone and/or email notification preferences.
 *
 * @body {string} [timezone] - IANA timezone (e.g., "America/New_York")
 * @body {Object} [emailPreferences] - Email preference toggles
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updatePreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.timezone !== undefined) {
      updateData.timezone = parsed.data.timezone;
    }

    if (parsed.data.emailPreferences !== undefined) {
      // Merge with existing preferences
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      const existing = (user?.emailPreferences as Record<string, boolean>) || {};
      updateData.emailPreferences = { ...existing, ...parsed.data.emailPreferences };
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    return Response.json({
      success: true,
      data: {
        timezone: updated.timezone || null,
        emailPreferences: updated.emailPreferences || {
          bookings: true,
          messages: true,
          reviews: true,
          reminders: true,
          marketing: false,
        },
      },
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update preferences' },
      },
      { status: 500 }
    );
  }
}
