import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface VerificationEmailProps {
  coachName: string;
  status: 'verified' | 'rejected';
  notes?: string;
  unsubscribeUrl?: string;
}

export function VerificationEmail({
  coachName,
  status,
  notes,
  unsubscribeUrl,
}: VerificationEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://co-duck.com';
  const isApproved = status === 'verified';

  return (
    <EmailLayout
      preview={
        isApproved
          ? `Your Co-duck profile has been verified!`
          : `Update on your Co-duck profile verification`
      }
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>{isApproved ? 'Profile Verified!' : 'Verification Update'}</Text>

      {isApproved ? (
        <>
          <Text style={paragraph}>
            Hi {coachName}, great news! Your coach profile on Co-duck has been verified.
            You now have a verification badge visible on your profile.
          </Text>
          <Text style={paragraph}>
            Verified coaches tend to receive more bookings and build trust faster with potential
            clients.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={`${appUrl}/dashboard/profile`}>
              View Your Profile
            </Button>
          </Section>
        </>
      ) : (
        <>
          <Text style={paragraph}>
            Hi {coachName}, we&apos;ve reviewed your coach profile and unfortunately it wasn&apos;t
            approved for verification at this time.
          </Text>
          {notes && (
            <Section style={noteSection}>
              <Text style={noteLabel}>Reviewer notes:</Text>
              <Text style={noteText}>{notes}</Text>
            </Section>
          )}
          <Text style={paragraph}>
            You can update your profile and re-submit for verification at any time.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={`${appUrl}/dashboard/profile`}>
              Update Profile
            </Button>
          </Section>
        </>
      )}
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

const noteSection = {
  margin: '0 0 24px',
  padding: '16px 24px',
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  borderLeft: '4px solid #f59e0b',
};

const noteLabel = {
  color: '#92400e',
  fontSize: '12px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  margin: '0 0 4px',
};

const noteText = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

export default VerificationEmail;
