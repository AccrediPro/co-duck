import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface SessionFollowUpEmailProps {
  clientName: string;
  coachName: string;
  subject: string;
  body: string;
  unsubscribeUrl?: string;
}

/**
 * Follow-up email sent by a coach to a client after a session.
 * Content is typically drafted by the AI Session Notes feature and
 * reviewed/edited by the coach before sending.
 */
export function SessionFollowUpEmail({
  clientName,
  coachName,
  subject,
  body,
  unsubscribeUrl,
}: SessionFollowUpEmailProps) {
  const preview = subject.slice(0, 80);
  const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <EmailLayout preview={preview} unsubscribeUrl={unsubscribeUrl}>
      <Heading
        style={{
          fontSize: '22px',
          fontWeight: '600',
          color: '#0F766E',
          marginBottom: '16px',
        }}
      >
        Hi {clientName || 'there'},
      </Heading>

      <Section>
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, idx) => (
            <Text
              key={idx}
              style={{
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#333',
                whiteSpace: 'pre-wrap',
                marginBottom: '16px',
              }}
            >
              {paragraph}
            </Text>
          ))
        ) : (
          <Text
            style={{
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#333',
              whiteSpace: 'pre-wrap',
              marginBottom: '16px',
            }}
          >
            {body}
          </Text>
        )}
      </Section>

      <Text
        style={{
          fontSize: '14px',
          color: '#666',
          marginTop: '24px',
        }}
      >
        — {coachName}
      </Text>
    </EmailLayout>
  );
}

export default SessionFollowUpEmail;
