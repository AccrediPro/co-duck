import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface NewMessageEmailProps {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationId: number;
  unsubscribeUrl?: string;
}

export function NewMessageEmail({
  recipientName,
  senderName,
  messagePreview,
  conversationId,
  unsubscribeUrl,
}: NewMessageEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://co-duck.com';
  const truncated =
    messagePreview.length > 150 ? messagePreview.slice(0, 150) + '...' : messagePreview;

  return (
    <EmailLayout preview={`New message from ${senderName}`} unsubscribeUrl={unsubscribeUrl}>
      <Text style={heading}>New Message</Text>
      <Text style={paragraph}>
        Hi {recipientName}, you have a new message from {senderName}.
      </Text>

      <Section style={messageBox}>
        <Text style={messageText}>&ldquo;{truncated}&rdquo;</Text>
        <Text style={senderLabel}>- {senderName}</Text>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/dashboard/messages/${conversationId}`}>
          Reply Now
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

const messageBox = {
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  borderLeft: '4px solid #2563eb',
};

const messageText = {
  color: '#1a1a1a',
  fontSize: '14px',
  lineHeight: '22px',
  fontStyle: 'italic' as const,
  margin: '0 0 8px',
};

const senderLabel = {
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

export default NewMessageEmail;
