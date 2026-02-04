import {
  Button,
  Column,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface SessionReminderEmailProps {
  coachName: string;
  sessionType: string;
  date: string;
  time: string;
  duration: number;
  meetingLink?: string;
  timeUntilSession: string; // e.g., "24 hours", "1 hour"
}

export function SessionReminderEmail({
  coachName,
  sessionType,
  date,
  time,
  duration,
  meetingLink,
  timeUntilSession,
}: SessionReminderEmailProps) {
  return (
    <EmailLayout preview={`Reminder: Your session with ${coachName} is in ${timeUntilSession}`}>
      <Text style={heading}>Session Reminder</Text>
      <Text style={paragraph}>
        Your coaching session with <strong>{coachName}</strong> is coming up in{' '}
        <strong>{timeUntilSession}</strong>. Here&apos;s everything you need to be prepared.
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
      </Section>

      {meetingLink && (
        <Section style={meetingSection}>
          <Text style={paragraph}>
            When it&apos;s time, join your session using the link below:
          </Text>
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
        <Text style={tipsTitle}>Quick Preparation Checklist</Text>
        <Text style={tipItem}>• Find a quiet, private space</Text>
        <Text style={tipItem}>• Test your internet, audio, and video</Text>
        <Text style={tipItem}>• Have water and any notes ready</Text>
        <Text style={tipItem}>• Prepare questions or topics to discuss</Text>
        <Text style={tipItem}>• Join 2-3 minutes early to get settled</Text>
      </Section>

      <Text style={paragraph}>
        Need to reschedule?{' '}
        <Link href="https://coachhub.com/dashboard/bookings" style={link}>
          Manage your booking
        </Link>{' '}
        before the session starts.
      </Text>

      <Text style={closingText}>
        We hope you have a great session!
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

const closingText = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  fontStyle: 'italic' as const,
};

export default SessionReminderEmail;
