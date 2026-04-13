import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCheckIns, conversations } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push-notifications';
import { createNotification } from '@/lib/notifications';

function getISOWeek(date: Date): { weekNumber: number; weekYear: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, weekYear: d.getUTCFullYear() };
}

function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[CreateCheckIns] CRON_SECRET is not configured');
    return false;
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === cronSecret;
}

/**
 * POST /api/cron/create-check-ins
 *
 * Runs daily at 08:00 UTC. Creates weekly check-in prompts for all coach-client pairs.
 * For each pair, checks if a check-in already exists this week. If not, and today
 * matches the client's checkInDay preference (default: 3 = Wednesday), creates one.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun..6=Sat
  const { weekNumber, weekYear } = getISOWeek(now);

  let created = 0;
  let skipped = 0;

  try {
    // Get all unique coach-client pairs from conversations
    const pairs = await db
      .select({
        coachId: conversations.coachId,
        clientId: conversations.clientId,
      })
      .from(conversations);

    if (pairs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { created: 0, skipped: 0 },
        timestamp: now.toISOString(),
      });
    }

    for (const pair of pairs) {
      try {
        // Check if a check-in already exists for this week
        const existing = await db.query.weeklyCheckIns.findFirst({
          where: and(
            eq(weeklyCheckIns.userId, pair.clientId),
            eq(weeklyCheckIns.coachId, pair.coachId),
            eq(weeklyCheckIns.weekNumber, weekNumber),
            eq(weeklyCheckIns.weekYear, weekYear)
          ),
          columns: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Get the client's preferred checkInDay from their most recent check-in with this coach
        const latestCheckIn = await db
          .select({ checkInDay: weeklyCheckIns.checkInDay })
          .from(weeklyCheckIns)
          .where(
            and(eq(weeklyCheckIns.userId, pair.clientId), eq(weeklyCheckIns.coachId, pair.coachId))
          )
          .orderBy(sql`${weeklyCheckIns.weekYear} DESC, ${weeklyCheckIns.weekNumber} DESC`)
          .limit(1);

        const preferredDay = latestCheckIn.length > 0 ? latestCheckIn[0].checkInDay : 3; // Default: Wednesday

        if (dayOfWeek !== preferredDay) {
          skipped++;
          continue;
        }

        // Create the check-in prompt
        await db.insert(weeklyCheckIns).values({
          userId: pair.clientId,
          coachId: pair.coachId,
          mood: 'good', // Will be overwritten when client responds — DB requires notNull
          weekNumber,
          weekYear,
          checkInDay: preferredDay,
          respondedAt: null,
          promptedAt: now,
        });

        // Send push notification to client
        sendPushNotification(pair.clientId, {
          title: 'Weekly check-in',
          body: 'How are you doing with your goal this week?',
          data: {
            type: 'weekly_check_in',
            link: '/dashboard',
          },
        });

        // Create in-app notification
        createNotification({
          userId: pair.clientId,
          type: 'system',
          title: 'Weekly check-in',
          body: 'How are you doing with your goal this week?',
          link: '/dashboard',
        });

        created++;
      } catch (pairError) {
        console.error(
          `[CreateCheckIns] Error processing pair coach=${pair.coachId} client=${pair.clientId}:`,
          pairError
        );
        skipped++;
      }
    }

    console.log(`[CreateCheckIns] Completed. Created: ${created}, Skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      data: { created, skipped },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CreateCheckIns] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        data: { created, skipped },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/create-check-ins
 * Alternative GET endpoint for cron services that use GET.
 */
export async function GET(request: Request) {
  return POST(request);
}
