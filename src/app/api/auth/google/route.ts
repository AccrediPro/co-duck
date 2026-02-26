import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAuthUrl, isGoogleCalendarConfigured } from '@/lib/google-calendar';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'auth-google');
  if (!rl.success) return rateLimitResponse(rl);

  if (!isGoogleCalendarConfigured()) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?gcal=error&reason=not_configured`);
  }

  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(
      new URL('/sign-in', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  const authUrl = getAuthUrl(userId);
  return NextResponse.redirect(authUrl);
}
