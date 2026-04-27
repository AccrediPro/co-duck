import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface ActionItemEmailProps {
  clientName: string;
  coachName: string;
  title: string;
  description?: string;
  dueDate?: string;
  unsubscribeUrl?: string;
}

export function ActionItemEmail({
  clientName,
  coachName,
  title,
  description,
  dueDate,
  unsubscribeUrl,
}: ActionItemEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro.com';

  return (
    <EmailLayout
      preview={`New action item from ${coachName}: ${title}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>New Action Item</Text>
      <Text style={paragraph}>
        Hi {clientName}, your coach {coachName} has assigned you a new action item.
      </Text>

      <Section style={taskSection}>
        <Text style={taskTitle}>{title}</Text>
        {description && <Text style={taskDescription}>{description}</Text>}
        {dueDate && <Text style={taskDue}>Due: {dueDate}</Text>}
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/dashboard/action-items`}>
          View Action Items
        </Button>
      </Section>

      <Text style={paragraph}>
        Stay on track with your goals by completing your action items on time.
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

const taskSection = {
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  borderLeft: '4px solid #0D9488',
};

const taskTitle = {
  color: '#0F766E',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
};

const taskDescription = {
  color: '#115E59',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 8px',
};

const taskDue = {
  color: '#4d7c0f',
  fontSize: '13px',
  fontWeight: '500' as const,
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

export default ActionItemEmail;
