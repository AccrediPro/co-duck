import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface ReviewRequestEmailProps {
  clientName: string;
  coachName: string;
  sessionType: string;
  sessionDate: string;
  coachSlug: string;
  unsubscribeUrl?: string;
}

export function ReviewRequestEmail({
  clientName,
  coachName,
  sessionType,
  sessionDate,
  coachSlug,
  unsubscribeUrl,
}: ReviewRequestEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro.com';

  return (
    <EmailLayout
      preview={`How was your session with ${coachName}?`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>How was your session?</Text>
      <Text style={paragraph}>
        Hi {clientName}, your {sessionType} session with {coachName} on {sessionDate} has been
        completed.
      </Text>

      <Text style={paragraph}>
        Your feedback helps other clients find the right coach and helps {coachName} improve. It
        only takes a minute.
      </Text>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/coaches/${coachSlug}`}>
          Leave a Review
        </Button>
      </Section>

      <Text style={muted}>
        You can also leave a review from your session details in the dashboard.
      </Text>
    </EmailLayout>
  );
}

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '0 0 16px',
};

const paragraph = {
  color: '#4a5568',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const muted = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '16px 0 0',
};

export default ReviewRequestEmail;
