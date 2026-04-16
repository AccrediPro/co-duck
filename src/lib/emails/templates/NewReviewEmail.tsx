import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface NewReviewEmailProps {
  coachName: string;
  clientName: string;
  rating: number;
  reviewTitle?: string;
  reviewContent?: string;
  bookingId: number;
  unsubscribeUrl?: string;
}

export function NewReviewEmail({
  coachName,
  clientName,
  rating,
  reviewTitle,
  reviewContent,
  bookingId,
  unsubscribeUrl,
}: NewReviewEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://co-duck.com';
  const stars = '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating);

  return (
    <EmailLayout
      preview={`${clientName} left you a ${rating}-star review`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>New Review Received</Text>
      <Text style={paragraph}>
        Hi {coachName}, {clientName} has left you a review.
      </Text>

      <Section style={reviewBox}>
        <Text style={starsStyle}>{stars}</Text>
        {reviewTitle && <Text style={titleStyle}>{reviewTitle}</Text>}
        {reviewContent && <Text style={contentStyle}>&ldquo;{reviewContent}&rdquo;</Text>}
        <Text style={authorStyle}>- {clientName}</Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/dashboard/sessions/${bookingId}`}>
          View Session Details
        </Button>
      </Section>

      <Text style={paragraph}>You can respond to this review from your dashboard.</Text>
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

const reviewBox = {
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#fffbeb',
  borderRadius: '8px',
  borderLeft: '4px solid #f59e0b',
};

const starsStyle = {
  color: '#f59e0b',
  fontSize: '24px',
  margin: '0 0 8px',
  letterSpacing: '2px',
};

const titleStyle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
};

const contentStyle = {
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

export default NewReviewEmail;
