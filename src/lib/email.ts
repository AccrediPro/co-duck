import { Resend } from 'resend';
import type { ReactElement } from 'react';

// Initialize Resend client - handle missing API key gracefully
const resendApiKey = process.env.RESEND_API_KEY;

let resend: Resend | null = null;

if (resendApiKey) {
  resend = new Resend(resendApiKey);
} else {
  console.warn('[Email] RESEND_API_KEY is not configured. Email sending will be disabled.');
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
  headers?: Record<string, string>;
}

interface SendEmailResult {
  success: boolean;
  data?: { id: string };
  error?: string;
}

/**
 * Send an email using Resend
 * @param options - Email options including to, subject, and react component
 * @returns Result object with success status and optional data/error
 */
export async function sendEmail({
  to,
  subject,
  react,
  from = 'Co-duck <noreply@co-duck.com>',
  headers,
}: SendEmailOptions): Promise<SendEmailResult> {
  if (!resend) {
    console.warn('[Email] Cannot send email - Resend client not initialized');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      react,
      ...(headers && { headers }),
    });

    if (error) {
      console.error('[Email] Failed to send email:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data ?? undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Exception while sending email:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export { resend };
