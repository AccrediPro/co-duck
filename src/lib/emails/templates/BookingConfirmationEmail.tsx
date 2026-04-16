import { Button, Column, Hr, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface BookingConfirmationEmailProps {
  coachName: string;
  sessionType: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  meetingLink?: string;
  unsubscribeUrl?: string;
}

export function BookingConfirmationEmail({
  coachName,
  sessionType,
  date,
  time,
  duration,
  price,
  meetingLink,
  unsubscribeUrl,
}: BookingConfirmationEmailProps) {
  return (
    <EmailLayout
      preview={`Your session with ${coachName} is confirmed!`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Booking Confirmed!</Text>
      <Text style={paragraph}>Great news! Your coaching session has been successfully booked.</Text>

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
            <Text style={totalLabel}>Total Paid</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={totalValue}>${price.toFixed(2)}</Text>
          </Column>
        </Row>
      </Section>

      {meetingLink && (
        <Section style={meetingSection}>
          <Text style={paragraph}>Join your session using the link below:</Text>
          <Button style={button} href={meetingLink}>
            Join Meeting
          </Button>
          <Text style={linkText}>
            Or copy this link:{' '}
            <Link href={meetingLink} style={link}>
              {meetingLink}
            </Link>
          </Text>
        </Section>
      )}

      <Section style={tipsSection}>
        <Text style={tipsTitle}>Before Your Session</Text>
        <Text style={tipItem}>• Find a quiet, comfortable space</Text>
        <Text style={tipItem}>• Test your audio and video beforehand</Text>
        <Text style={tipItem}>• Have any questions or topics ready to discuss</Text>
      </Section>

      <Text style={paragraph}>
        Need to make changes?{' '}
        <Link href="https://co-duck.com/dashboard/bookings" style={link}>
          Manage your booking
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

const meetingSection = {
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

const tipsSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
};

const tipsTitle = {
  color: '#1e40af',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 12px',
};

const tipItem = {
  color: '#1e40af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '4px 0',
};

export default BookingConfirmationEmail;
