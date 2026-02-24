/**
 * @fileoverview Email Unsubscribe API
 *
 * One-click unsubscribe from email notifications (CAN-SPAM compliance).
 * Uses HMAC token verification — no auth required.
 *
 * @module api/settings/unsubscribe
 */

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUnsubscribeToken, type EmailCategory } from '@/lib/unsubscribe';

const VALID_CATEGORIES: EmailCategory[] = [
  'bookings',
  'messages',
  'reviews',
  'reminders',
  'marketing',
];

/**
 * GET /api/settings/unsubscribe
 *
 * Unsubscribe a user from a specific email category.
 * Token-verified, no authentication required (accessed from email links).
 *
 * @query {string} userId - User's ID
 * @query {string} category - Email category to unsubscribe from
 * @query {string} token - HMAC verification token
 *
 * @returns HTML page confirming unsubscription
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const category = searchParams.get('category') as EmailCategory | null;
  const token = searchParams.get('token');

  if (!userId || !category || !token) {
    return new Response(htmlPage('Invalid Link', 'This unsubscribe link is missing parameters.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return new Response(htmlPage('Invalid Category', 'Unknown email category.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!verifyUnsubscribeToken(userId, category, token)) {
    return new Response(
      htmlPage('Invalid Token', 'This unsubscribe link has expired or is invalid.'),
      {
        status: 403,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return new Response(htmlPage('User Not Found', 'We could not find your account.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Merge with existing preferences
    const existing = (user.emailPreferences as Record<string, boolean>) || {};
    const updated = { ...existing, [category]: false };

    await db.update(users).set({ emailPreferences: updated }).where(eq(users.id, userId));

    const categoryLabels: Record<EmailCategory, string> = {
      bookings: 'booking notifications',
      messages: 'message notifications',
      reviews: 'review notifications',
      reminders: 'session reminders',
      marketing: 'marketing emails',
    };

    return new Response(
      htmlPage(
        'Unsubscribed',
        `You have been unsubscribed from ${categoryLabels[category]}. You can re-enable this in your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://coachhub.com'}/dashboard/settings">account settings</a>.`
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return new Response(htmlPage('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - CoachHub</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f6f9fc; color: #4a5568; }
    .card { background: white; padding: 48px; border-radius: 12px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #1a1a1a; font-size: 24px; margin: 0 0 16px; }
    p { line-height: 1.6; margin: 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
