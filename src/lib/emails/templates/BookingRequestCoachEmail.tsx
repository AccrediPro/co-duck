import { Button, Column, Hr, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface BookingRequestCoachEmailProps {
  coachName: string;
  clientName: string;
  sessionType: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  bookingId: number;
  unsubscribeUrl?: string;
}

export function BookingRequestCoachEmail({
  coachName,
  clientName,
  sessionType,
  date,
  time,
  duration,
  price,
  bookingId,
  unsubscribeUrl,
}: BookingRequestCoachEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro-coachhub.com';
  const bookingUrl = `${appUrl}/dashboard/sessions/${bookingId}`;

  return (
    <EmailLayout
      preview={`New booking request from ${clientName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>New Booking Request</Text>
      <Text style={paragraph}>
        Hi {coachName}, you have a new booking request from {clientName}. Please review and accept
        or decline.
      </Text>

      <Section style={detailsContainer}>
        <Text style={sectionTitle}>Session Details</Text>

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={label}>Client</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>{clientName}</Text>
          </Column>
        </Row>

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={label}>Session Type</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>{sessionType}</Text>
          </Column>
        </Row>

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={label}>Date</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>{date}</Text>
          </Column>
        </Row>

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={label}>Time</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>{time}</Text>
          </Column>
        </Row>

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={label}>Duration</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>{duration} minutes</Text>
          </Column>
        </Row>

        <Hr style={hr} />

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={totalLabel}>Session Price</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={totalValue}>${price.toFixed(2)}</Text>
          </Column>
        </Row>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>
          Review Booking Request
        </Button>
        <Text style={linkText}>
          Or go to:{' '}
          <Link href={bookingUrl} style={link}>
            {bookingUrl}
          </Link>
        </Text>
      </Section>

      <Section style={noteSection}>
        <Text style={noteTitle}>Please respond promptly</Text>
        <Text style={noteText}>
          The client has already paid for this session. If you do not accept before the session time,
          the booking will be automatically cancelled and the client will receive a full refund.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600' as const,
  lineHeight: '32px',
  margin: '0 0 16px',
};

const paragraph = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px',
};

const detailsContainer = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '24px',
};

const sectionTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 16px',
};

const detailRow = {
  marginBottom: '12px',
};

const labelColumn = {
  width: '140px',
};

const valueColumn = {
  width: 'auto',
};

const label = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0',
};

const value = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500' as const,
  margin: '0',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '16px 0',
};

const totalLabel = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0',
};

const totalValue = {
  color: '#2563eb',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0',
};

const ctaSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '16px 0',
};

const linkText = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '8px 0 0',
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const noteSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
};

const noteTitle = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
};

const noteText = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

export default BookingRequestCoachEmail;
