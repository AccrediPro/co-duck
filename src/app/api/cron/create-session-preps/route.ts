import { NextResponse } from 'next/server';
import { db } from '@/db';
import { bookings, sessionPrepResponses, sessionPrepQuestions, users } from '@/db/schema';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

/**
 * Verifies the CRON_SECRET from the Authorization header.
 */
function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[CreateSessionPreps] CRON_SECRET is not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === cronSecret;
}

/**
 * Retrieves prep questions for a given coach.
 * Falls back to default questions if coach hasn't customized.
 */
async function getQuestionsForCoach(coachId: string): Promise<string[]> {
  const custom = await db
    .select({ questions: sessionPrepQuestions.questions })
    .from(sessionPrepQuestions)
    .where(eq(sessionPrepQuestions.coachId, coachId))
    .limit(1);

  if (custom.length > 0) return custom[0].questions;

  const defaults = await db
    .select({ questions: sessionPrepQuestions.questions })
    .from(sessionPrepQuestions)
    .where(
      and(
        isNull(sessionPrepQuestions.coachId),
        eq(sessionPrepQuestions.isDefault, true)
      )
    )
    .limit(1);

  return defaults.length > 0 ? defaults[0].questions : [];
}

/**
 * POST /api/cron/create-session-preps
 *
 * Runs hourly. Creates session prep prompts for bookings starting in 23-25 hours.
 * Sends push notification to client to prepare for their session.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let created = 0;
  let skipped = 0;

  try {
    const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Find confirmed bookings starting in 23-25 hours
    const upcomingBookings = await db
      .select({
        booking: bookings,
        coach: { name: users.name },
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.coachId, users.id))
      .where(
        and(
          eq(bookings.status, 'confirmed'),
          gte(bookings.startTime, twentyThreeHoursFromNow),
          lte(bookings.startTime, twentyFiveHoursFromNow)
        )
      );

    for (const { booking, coach } of upcomingBookings) {
      try {
        // Check if prep already exists for this booking
        const existingPrep = await db
          .select({ id: sessionPrepResponses.id })
          .from(sessionPrepResponses)
          .where(eq(sessionPrepResponses.bookingId, booking.id))
          .limit(1);

        if (existingPrep.length > 0) {
          skipped++;
          continue;
        }

        // Get questions for this coach
        const questions = await getQuestionsForCoach(booking.coachId);

        if (questions.length === 0) {
          console.warn(`[CreateSessionPreps] No questions found for coach ${booking.coachId}, skipping booking ${booking.id}`);
          skipped++;
          continue;
        }

        // Create prep record (responses null, completedAt null)
        await db.insert(sessionPrepResponses).values({
          bookingId: booking.id,
          userId: booking.clientId,
          coachId: booking.coachId,
          responses: [],
          promptedAt: now,
        });

        // Send notification to client
        createNotification({
          userId: booking.clientId,
          type: 'system',
          title: 'Preparati per la sessione',
          body: `La tua sessione con ${coach.name || 'il tuo coach'} è domani. Vuoi prepararti?`,
          link: '/dashboard/session-prep',
        });

        created++;
      } catch (error) {
        console.error(`[CreateSessionPreps] Error creating prep for booking ${booking.id}:`, error);
        skipped++;
      }
    }

    console.log(`[CreateSessionPreps] Completed. Created: ${created}, Skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      data: { created, skipped },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CreateSessionPreps] Error:', errorMessage);

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
 * GET /api/cron/create-session-preps
 * Alternative GET endpoint for cron services that use GET.
 */
export async function GET(request: Request) {
  return POST(request);
}
