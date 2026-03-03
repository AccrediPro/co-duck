import { Button, Section, Text, Hr } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface PaymentReceiptEmailProps {
  clientName: string;
  coachName: string;
  sessionType: string;
  sessionDate: string;
  sessionTime: string;
  duration: number;
  amountCents: number;
  currency: string;
  transactionId: number;
  bookingId: number;
  unsubscribeUrl?: string;
}

export function PaymentReceiptEmail({
  clientName,
  coachName,
  sessionType,
  sessionDate,
  sessionTime,
  duration,
  amountCents,
  currency,
  transactionId,
  bookingId,
  unsubscribeUrl,
}: PaymentReceiptEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accredipro-coachhub.com';
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

  return (
    <EmailLayout
      preview={`Payment receipt for ${sessionType} with ${coachName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Payment Receipt</Text>
      <Text style={paragraph}>
        Hi {clientName}, here&apos;s your receipt for your coaching session.
      </Text>

      <Section style={receiptSection}>
        <Text style={receiptRow}>
          <span style={receiptLabel}>Session</span>
          <span style={receiptValue}>{sessionType}</span>
        </Text>
        <Text style={receiptRow}>
          <span style={receiptLabel}>Coach</span>
          <span style={receiptValue}>{coachName}</span>
        </Text>
        <Text style={receiptRow}>
          <span style={receiptLabel}>Date</span>
          <span style={receiptValue}>{sessionDate}</span>
        </Text>
        <Text style={receiptRow}>
          <span style={receiptLabel}>Time</span>
          <span style={receiptValue}>{sessionTime}</span>
        </Text>
        <Text style={receiptRow}>
          <span style={receiptLabel}>Duration</span>
          <span style={receiptValue}>{duration} minutes</span>
        </Text>
        <Hr style={divider} />
        <Text style={receiptRow}>
          <span style={totalLabel}>Total Paid</span>
          <span style={totalValue}>{formattedAmount}</span>
        </Text>
      </Section>

      <Text style={metaText}>Transaction #{transactionId}</Text>

      <Section style={buttonContainer}>
        <Button style={button} href={`${appUrl}/dashboard/my-sessions/${bookingId}`}>
          View Session Details
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions about this charge, please contact your coach or reach out to our
        support team.
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

const receiptSection = {
  margin: '0 0 24px',
  padding: '20px 24px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const receiptRow = {
  color: '#4a5568',
  fontSize: '14px',
  lineHeight: '16px',
  margin: '0 0 12px',
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
};

const receiptLabel = {
  color: '#64748b',
  fontWeight: '400' as const,
};

const receiptValue = {
  color: '#1e293b',
  fontWeight: '500' as const,
};

const divider = {
  borderColor: '#cbd5e1',
  margin: '12px 0',
};

const totalLabel = {
  color: '#1e293b',
  fontWeight: '600' as const,
  fontSize: '16px',
};

const totalValue = {
  color: '#1e293b',
  fontWeight: '700' as const,
  fontSize: '16px',
};

const metaText = {
  color: '#94a3b8',
  fontSize: '12px',
  textAlign: 'center' as const,
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

export default PaymentReceiptEmail;
