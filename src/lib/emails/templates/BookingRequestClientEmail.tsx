import { Column, Hr, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface BookingRequestClientEmailProps {
  clientName: string;
  coachName: string;
  sessionType: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  unsubscribeUrl?: string;
}

export function BookingRequestClientEmail({
  clientName,
  coachName,
  sessionType,
  date,
  time,
  duration,
  price,
  unsubscribeUrl,
}: BookingRequestClientEmailProps) {
  return (
    <EmailLayout
      preview={`Your booking request with ${coachName} has been submitted`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Booking Request Submitted</Text>
      <Text style={paragraph}>
        Hi {clientName}, your booking request has been submitted and payment has been received.{' '}
        {coachName} will review it shortly.
      </Text>

      <Section style={detailsContainer}>
        <Text style={sectionTitle}>Session Details</Text>

        <Row style={detailRow}>
          <Column style={labelColumn}>
            <Text style={label}>Coach</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>{coachName}</Text>
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
            <Text style={totalLabel}>Amount Paid</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={totalValue}>${price.toFixed(2)}</Text>
          </Column>
        </Row>
      </Section>

      <Section style={statusSection}>
        <Text style={statusTitle}>What happens next?</Text>
        <Text style={statusText}>
          Your coach will review this booking request and accept or decline it. You will receive an
          email notification once they respond. If the request is declined, you will receive a full
          refund.
        </Text>
      </Section>

      <Text style={paragraph}>
        Have questions?{' '}
        <Link href="https://coachhub.com/dashboard/messages" style={link}>
          Message your coach
        </Link>{' '}
        or{' '}
        <Link href="https://coachhub.com/support" style={link}>
          contact support
        </Link>
      </Text>
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

const statusSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
};

const statusTitle = {
  color: '#1e40af',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
};

const statusText = {
  color: '#1e40af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export default BookingRequestClientEmail;
