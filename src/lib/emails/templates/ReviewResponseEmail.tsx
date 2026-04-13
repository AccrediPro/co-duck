import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface ReviewResponseEmailProps {
  clientName: string;
  coachName: string;
  responseText: string;
  bookingId: number;
  unsubscribeUrl?: string;
}

export function ReviewResponseEmail({
  clientName,
  coachName,
  responseText,
  bookingId,
  unsubscribeUrl,
}: ReviewResponseEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro-coachhub.com';

  return (
    <EmailLayout preview={`${coachName} responded to your review`} unsubscribeUrl={unsubscribeUrl}>
      <Text style={heading}>Coach Responded to Your Review</Text>
      <Text style={paragraph}>
        Hi {clientName}, {coachName} has responded to your review.
      </Text>

      <Section style={responseBox}>
        <Text style={responseLabel}>Coach&apos;s Response</Text>
        <Text style={responseContent}>&ldquo;{responseText}&rdquo;</Text>
        <Text style={authorStyle}>- {coachName}</Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/dashboard/my-sessions/${bookingId}`}>
          View Session Details
        </Button>
      </Section>
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

const responseBox = {
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  borderLeft: '4px solid #2563eb',
};

const responseLabel = {
  color: '#2563eb',
  fontSize: '12px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
};

const responseContent = {
  color: '#4a5568',
  fontSize: '14px',
  lineHeight: '22px',
  fontStyle: 'italic' as const,
  margin: '0 0 8px',
};

const authorStyle = {
  color: '#8898aa',
  fontSize: '12px',
  margin: '0',
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

export default ReviewResponseEmail;
