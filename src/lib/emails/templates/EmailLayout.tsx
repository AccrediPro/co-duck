import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  preview?: string;
  unsubscribeUrl?: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, unsubscribeUrl, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>CoachHub</Text>
          </Section>

          {/* Body Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this email because you have an account with CoachHub.
            </Text>
            <Text style={footerText}>
              {unsubscribeUrl && (
                <>
                  <Link href={unsubscribeUrl} style={link}>
                    Unsubscribe
                  </Link>
                  {' | '}
                </>
              )}
              <Link href="https://coachhub.com/privacy" style={link}>
                Privacy Policy
              </Link>
            </Text>
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} CoachHub. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '24px 32px',
  borderBottom: '1px solid #e6ebf1',
};

const logo = {
  color: '#2563eb',
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '0',
};

const content = {
  padding: '32px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  padding: '0 32px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
  textAlign: 'center' as const,
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export default EmailLayout;
