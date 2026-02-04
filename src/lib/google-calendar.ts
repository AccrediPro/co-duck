import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { db, googleCalendarTokens } from '@/db';
import type { BookingSessionType } from '@/db/schema';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

/**
 * Check if Google Calendar OAuth is configured via environment variables.
 * Returns false if any required env var is missing — all gcal features become no-ops.
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleOAuth2Client() {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.');
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = getGoogleOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getGoogleOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(userId: string) {
  const tokenRecords = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId))
    .limit(1);

  if (tokenRecords.length === 0 || !tokenRecords[0].isConnected) {
    return null;
  }

  const tokenRecord = tokenRecords[0];
  const oauth2Client = getGoogleOAuth2Client();

  oauth2Client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken,
    expiry_date: tokenRecord.tokenExpiresAt.getTime(),
  });

  // Auto-refresh if token is expired
  if (tokenRecord.tokenExpiresAt <= new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      await db
        .update(googleCalendarTokens)
        .set({
          accessToken: credentials.access_token!,
          tokenExpiresAt: new Date(credentials.expiry_date!),
        })
        .where(eq(googleCalendarTokens.userId, userId));

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Failed to refresh Google Calendar token:', error);
      // Mark as disconnected if refresh fails
      await db
        .update(googleCalendarTokens)
        .set({ isConnected: false })
        .where(eq(googleCalendarTokens.userId, userId));
      return null;
    }
  }

  return oauth2Client;
}

export async function createCalendarEvent(
  userId: string,
  booking: {
    id: number;
    startTime: Date;
    endTime: Date;
    sessionType: BookingSessionType;
    meetingLink: string | null;
    otherUserName: string | null;
    otherUserEmail: string | null;
    isCoach: boolean;
  }
): Promise<string | null> {
  const oauth2Client = await getAuthenticatedClient(userId);
  if (!oauth2Client) return null;

  const tokenRecord = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId))
    .limit(1);

  const calendarId = tokenRecord[0]?.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const roleName = booking.isCoach ? 'Coaching Session with' : 'Coaching Session with';
  const otherName = booking.otherUserName || (booking.isCoach ? 'Client' : 'Coach');

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${roleName} ${otherName}`,
      description: `${booking.sessionType.name} (${booking.sessionType.duration} minutes)${booking.meetingLink ? `\n\nMeeting Link: ${booking.meetingLink}` : ''}`,
      start: {
        dateTime: booking.startTime.toISOString(),
      },
      end: {
        dateTime: booking.endTime.toISOString(),
      },
      ...(booking.meetingLink && {
        conferenceData: undefined,
        location: booking.meetingLink,
      }),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    },
  });

  return event.data.id || null;
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  booking: {
    startTime: Date;
    endTime: Date;
    sessionType: BookingSessionType;
    meetingLink: string | null;
    otherUserName: string | null;
  }
): Promise<boolean> {
  const oauth2Client = await getAuthenticatedClient(userId);
  if (!oauth2Client) return false;

  const tokenRecord = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId))
    .limit(1);

  const calendarId = tokenRecord[0]?.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      description: `${booking.sessionType.name} (${booking.sessionType.duration} minutes)${booking.meetingLink ? `\n\nMeeting Link: ${booking.meetingLink}` : ''}`,
      start: {
        dateTime: booking.startTime.toISOString(),
      },
      end: {
        dateTime: booking.endTime.toISOString(),
      },
      ...(booking.meetingLink && { location: booking.meetingLink }),
    },
  });

  return true;
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const oauth2Client = await getAuthenticatedClient(userId);
  if (!oauth2Client) return false;

  const tokenRecord = await db
    .select({ calendarId: googleCalendarTokens.calendarId })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, userId))
    .limit(1);

  const calendarId = tokenRecord[0]?.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId,
    eventId,
  });

  return true;
}
