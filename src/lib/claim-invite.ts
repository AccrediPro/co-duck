import { db } from '@/db';
import { users, coachProfiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Check if a user's email matches a pending coach invite.
 * If so: update their role to 'coach', create a minimal coach_profiles record,
 * and mark the invite as 'claimed'.
 *
 * Uses raw SQL for coach_invites queries since the table may not exist in the
 * Drizzle schema yet (created by R2 agent in parallel). Once R2's schema is
 * merged, this can be refactored to use typed Drizzle queries.
 *
 * Safe to call multiple times — no-ops if no pending invite or already claimed.
 *
 * @returns true if an invite was claimed, false otherwise
 */
export async function claimCoachInvite(
  userId: string,
  email: string,
  name: string | null,
): Promise<boolean> {
  try {
    // Check for pending invite matching this email (raw SQL — table may not be in Drizzle schema yet)
    const result = await db.execute(
      sql`SELECT id FROM coach_invites WHERE LOWER(email) = LOWER(${email}) AND status = 'pending' LIMIT 1`,
    );

    const rows = result as unknown as { id: number }[];
    if (!rows || rows.length === 0) return false;

    const inviteId = rows[0].id;

    // Update user role to coach
    await db.update(users).set({ role: 'coach' }).where(eq(users.id, userId));

    // Create minimal coach profile (slug from name or email prefix)
    const slug = generateSlug(name, email);
    await db
      .insert(coachProfiles)
      .values({ userId, slug })
      .onConflictDoNothing();

    // Mark invite as claimed
    await db.execute(
      sql`UPDATE coach_invites SET status = 'claimed', claimed_at = NOW() WHERE id = ${inviteId}`,
    );

    return true;
  } catch (error) {
    // If coach_invites table doesn't exist yet, silently skip
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('coach_invites') ||
      message.includes('does not exist') ||
      message.includes('relation')
    ) {
      return false;
    }
    console.error('Error claiming coach invite:', error);
    return false;
  }
}

function generateSlug(name: string | null, email: string): string {
  const base = name || email.split('@')[0];
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Add random suffix to avoid collisions
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}
