import { db } from '@/db';
import { coachingStreaks, streakActivities, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSocketServer } from '@/lib/socket-server';
import { sendPushNotification } from '@/lib/push-notifications';
import { createNotification } from '@/lib/notifications';

// ─── ISO Week Helpers ────────────────────────────────

function getISOWeek(date: Date): { weekNumber: number; weekYear: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, weekYear: d.getUTCFullYear() };
}

function getPreviousISOWeek(weekNumber: number, weekYear: number): { weekNumber: number; weekYear: number } {
  if (weekNumber > 1) {
    return { weekNumber: weekNumber - 1, weekYear };
  }
  // Week 1 → last week of previous year (either 52 or 53)
  const dec31 = new Date(Date.UTC(weekYear - 1, 11, 31));
  const { weekNumber: lastWeek } = getISOWeek(dec31);
  return { weekNumber: lastWeek, weekYear: weekYear - 1 };
}

// ─── Streak Socket.io Event ─────────────────────────

function emitStreakUpdated(
  userId: string,
  data: { currentStreak: number; longestStreak: number; isAtRisk: boolean }
): void {
  try {
    const io = getSocketServer();
    if (!io) return;
    io.to(`user:${userId}`).emit('streak:updated', data);
  } catch {
    // Fire-and-forget
  }
}

// ─── Milestone Check ────────────────────────────────

const MILESTONE_WEEKS = [4, 8, 12, 24, 52];

// ─── Core: Record Streak Activity ───────────────────

export async function recordStreakActivity(
  userId: string,
  actionType: 'session_completed' | 'action_item_completed' | 'iconnect_post' | 'message_sent' | 'check_in_completed' | 'session_prep_completed',
  referenceId?: string
): Promise<void> {
  try {
    const now = new Date();
    const { weekNumber, weekYear } = getISOWeek(now);

    // Insert activity record
    await db.insert(streakActivities).values({
      userId,
      actionType,
      referenceId: referenceId ?? null,
      weekNumber,
      weekYear,
    });

    // Upsert coaching streak
    const existing = await db.query.coachingStreaks.findFirst({
      where: eq(coachingStreaks.userId, userId),
    });

    if (!existing) {
      // First ever activity — create streak row
      const [inserted] = await db.insert(coachingStreaks).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityAt: now,
        streakStartedAt: now,
        isAtRisk: false,
        notifiedAtRisk: false,
      }).returning();

      emitStreakUpdated(userId, {
        currentStreak: inserted.currentStreak,
        longestStreak: inserted.longestStreak,
        isAtRisk: inserted.isAtRisk,
      });
    } else {
      // Update existing streak — clear at-risk flag
      const updateData: Record<string, unknown> = {
        lastActivityAt: now,
        isAtRisk: false,
        notifiedAtRisk: false,
      };

      // If streak was broken (currentStreak === 0), restart it
      if (existing.currentStreak === 0) {
        updateData.streakStartedAt = now;
        updateData.currentStreak = 1;
        updateData.longestStreak = Math.max(existing.longestStreak, 1);
      }

      const [updated] = await db
        .update(coachingStreaks)
        .set(updateData)
        .where(eq(coachingStreaks.userId, userId))
        .returning();

      emitStreakUpdated(userId, {
        currentStreak: updated.currentStreak,
        longestStreak: updated.longestStreak,
        isAtRisk: updated.isAtRisk,
      });
    }
  } catch (error) {
    console.error('[streaks] Failed to record streak activity:', error);
  }
}

// ─── Core: Evaluate Streaks (CRON) ──────────────────

export async function evaluateStreaks(): Promise<{
  evaluated: number;
  incremented: number;
  reset: number;
  atRisk: number;
  milestones: number;
}> {
  const now = new Date();
  const { weekNumber: currentWeek, weekYear: currentYear } = getISOWeek(now);
  const { weekNumber: prevWeek, weekYear: prevYear } = getPreviousISOWeek(currentWeek, currentYear);
  const dayOfWeek = now.getUTCDay(); // 0=Sunday, 5=Friday

  const stats = { evaluated: 0, incremented: 0, reset: 0, atRisk: 0, milestones: 0 };

  // Get all users with streak rows
  const allStreaks = await db.select().from(coachingStreaks);

  for (const streak of allStreaks) {
    stats.evaluated++;

    try {
      // Check activity for current week
      const currentWeekActivities = await db
        .select()
        .from(streakActivities)
        .where(
          eq(streakActivities.userId, streak.userId)
        )
        .then(rows => rows.filter(r => r.weekNumber === currentWeek && r.weekYear === currentYear));

      // Check activity for previous week
      const prevWeekActivities = await db
        .select()
        .from(streakActivities)
        .where(
          eq(streakActivities.userId, streak.userId)
        )
        .then(rows => rows.filter(r => r.weekNumber === prevWeek && r.weekYear === prevYear));

      const hadActivityPrevWeek = prevWeekActivities.length > 0;
      const hadActivityCurrentWeek = currentWeekActivities.length > 0;

      const updateData: Record<string, unknown> = {};

      // Weekly evaluation: check previous week for consecutive streak
      if (hadActivityPrevWeek && streak.currentStreak > 0) {
        // Previous week had activity and streak is active — increment
        const newStreak = streak.currentStreak + 1;
        updateData.currentStreak = newStreak;
        updateData.longestStreak = Math.max(streak.longestStreak, newStreak);
        stats.incremented++;

        // Check milestones
        if (MILESTONE_WEEKS.includes(newStreak)) {
          stats.milestones++;
          sendPushNotification(streak.userId, {
            title: 'Streak milestone!',
            body: `Amazing! ${newStreak} consecutive weeks of coaching!`,
            data: { type: 'streak_milestone', streak: String(newStreak) },
          });
          createNotification({
            userId: streak.userId,
            type: 'system',
            title: 'Streak milestone!',
            body: `Amazing! ${newStreak} consecutive weeks of coaching!`,
            link: '/dashboard',
          });
        }
      } else if (!hadActivityPrevWeek && streak.currentStreak > 0) {
        // No activity previous week — reset streak
        updateData.currentStreak = 0;
        updateData.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
        updateData.streakStartedAt = null;
        stats.reset++;
      }

      // Friday at-risk check: if no activity THIS week yet
      if (dayOfWeek === 5 && !hadActivityCurrentWeek && streak.currentStreak > 0) {
        updateData.isAtRisk = true;
        stats.atRisk++;

        if (!streak.notifiedAtRisk) {
          updateData.notifiedAtRisk = true;
          sendPushNotification(streak.userId, {
            title: 'Your streak is about to expire!',
            body: `You have a ${streak.currentStreak}-week streak. Complete an action to keep it alive!`,
            data: { type: 'streak_at_risk', streak: String(streak.currentStreak) },
          });
          createNotification({
            userId: streak.userId,
            type: 'system',
            title: 'Your streak is about to expire!',
            body: `You have a ${streak.currentStreak}-week streak. Complete an action to keep it alive!`,
            link: '/dashboard',
          });
        }
      }

      // Apply updates if any
      if (Object.keys(updateData).length > 0) {
        const [updated] = await db
          .update(coachingStreaks)
          .set(updateData)
          .where(eq(coachingStreaks.id, streak.id))
          .returning();

        emitStreakUpdated(streak.userId, {
          currentStreak: updated.currentStreak,
          longestStreak: updated.longestStreak,
          isAtRisk: updated.isAtRisk,
        });
      }
    } catch (error) {
      console.error(`[streaks] Failed to evaluate streak for user ${streak.userId}:`, error);
    }
  }

  console.log(
    `[streaks] Evaluation complete. Evaluated: ${stats.evaluated}, Incremented: ${stats.incremented}, Reset: ${stats.reset}, At-risk: ${stats.atRisk}, Milestones: ${stats.milestones}`
  );

  return stats;
}
