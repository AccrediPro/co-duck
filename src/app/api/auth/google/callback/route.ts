import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, googleCalendarTokens } from '@/db';
import { exchangeCodeForTokens } from '@/lib/google-calendar';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, WRITE_LIMIT, 'auth-google-callback');
  if (!rl.success) return rateLimitResponse(rl);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/dashboard/settings`;

  if (error) {
    return NextResponse.redirect(`${settingsUrl}?gcal=error&reason=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?gcal=error&reason=missing_params`);
  }

  const userId = state;

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${settingsUrl}?gcal=error&reason=no_tokens`);
    }

    // Upsert the token record
    const existing = await db
      .select({ userId: googleCalendarTokens.userId })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(googleCalendarTokens)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
          isConnected: true,
        })
        .where(eq(googleCalendarTokens.userId, userId));
    } else {
      await db.insert(googleCalendarTokens).values({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
        isConnected: true,
      });
    }

    return NextResponse.redirect(`${settingsUrl}?gcal=connected`);
  } catch (error) {
    console.error('Google Calendar OAuth callback error:', error);
    return NextResponse.redirect(`${settingsUrl}?gcal=error&reason=exchange_failed`);
  }
}
