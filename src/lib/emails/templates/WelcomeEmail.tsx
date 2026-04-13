import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface WelcomeEmailProps {
  name: string;
  unsubscribeUrl?: string;
}

export function WelcomeEmail({ name, unsubscribeUrl }: WelcomeEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro-coachhub.com';

  return (
    <EmailLayout
      preview={`Welcome to AccrediPro CoachHub, ${name}!`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Welcome to AccrediPro CoachHub!</Text>
      <Text style={paragraph}>
        Hi {name}, thanks for joining AccrediPro CoachHub. You now have access to a network of
        expert coaches ready to help you grow.
      </Text>

      <Text style={paragraph}>Here&apos;s how to get started:</Text>

      <Section style={listSection}>
        <Text style={listItem}>1. Browse our coaches and find your match</Text>
        <Text style={listItem}>2. Book a session that fits your schedule</Text>
        <Text style={listItem}>3. Connect and start your growth journey</Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/coaches`}>
          Browse Coaches
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions, don&apos;t hesitate to reach out. We&apos;re here to help.
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

const listSection = {
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
};

const listItem = {
  color: '#4a5568',
  fontSize: '14px',
  lineHeight: '28px',
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

export default WelcomeEmail;
