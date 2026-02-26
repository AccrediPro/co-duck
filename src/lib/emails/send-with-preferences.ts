import type { ReactElement } from 'react';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { getUnsubscribeUrl, type EmailCategory } from '@/lib/unsubscribe';

interface EmailPreferences {
  bookings?: boolean;
  messages?: boolean;
  reviews?: boolean;
  reminders?: boolean;
  marketing?: boolean;
}

/**
 * Send an email with preference checking and List-Unsubscribe header.
 *
 * Looks up the user's email preferences and only sends if the category is enabled.
 * Defaults to enabled (true) if no preference is set for the category.
 * Adds RFC 8058 List-Unsubscribe headers for one-click unsubscribe support.
 */
export async function sendEmailWithPreferences(
  userId: string,
  category: EmailCategory,
  email: string,
  subject: string,
  template: ReactElement
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { emailPreferences: true },
  });

  const preferences = (user?.emailPreferences as EmailPreferences) || {};
  const isEnabled = preferences[category] !== false;

  if (!isEnabled) {
    console.log(`[Email] Skipped: ${category} emails disabled for user ${userId}`);
    return;
  }

  const unsubscribeUrl = getUnsubscribeUrl(userId, category);

  await sendEmail({
    to: email,
    subject,
    react: template,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}
