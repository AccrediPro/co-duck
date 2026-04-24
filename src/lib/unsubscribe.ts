import { createHmac } from 'crypto';

const UNSUBSCRIBE_SECRET = process.env.CLERK_SECRET_KEY || 'fallback-unsubscribe-secret';

export type EmailCategory = 'bookings' | 'messages' | 'reviews' | 'reminders' | 'marketing';

/**
 * Generate an HMAC token for unsubscribe verification.
 * This prevents users from unsubscribing other users via URL manipulation.
 */
function generateToken(userId: string, category: EmailCategory): string {
  return createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(`${userId}:${category}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Verify an unsubscribe token.
 */
export function verifyUnsubscribeToken(
  userId: string,
  category: EmailCategory,
  token: string
): boolean {
  const expected = generateToken(userId, category);
  return token === expected;
}

/**
 * Generate a full unsubscribe URL for an email category.
 */
export function getUnsubscribeUrl(userId: string, category: EmailCategory): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro.com';
  const token = generateToken(userId, category);
  return `${appUrl}/api/settings/unsubscribe?userId=${encodeURIComponent(userId)}&category=${category}&token=${token}`;
}
