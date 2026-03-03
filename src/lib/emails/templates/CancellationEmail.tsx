import { Column, Hr, Link, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './EmailLayout';

interface CancellationEmailProps {
  coachName: string;
  sessionType: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'not_applicable';
  cancelledBy: 'client' | 'coach';
  reason?: string;
  unsubscribeUrl?: string;
}

export function CancellationEmail({
  coachName,
  sessionType,
  date,
  time,
  duration,
  price,
  refundAmount,
  refundStatus = 'pending',
  cancelledBy,
  reason,
  unsubscribeUrl,
}: CancellationEmailProps) {
  const getRefundMessage = () => {
    if (refundStatus === 'not_applicable') {
      return 'No refund applicable for this cancellation based on the cancellation policy.';
    }
    if (refundStatus === 'processed') {
      return `A refund of $${refundAmount?.toFixed(2)} has been processed and will appear in your account within 5-10 business days.`;
    }
    return `A refund of $${refundAmount?.toFixed(2)} is being processed and will appear in your account within 5-10 business days.`;
  };

  return (
    <EmailLayout
      preview={`Session with ${coachName} has been cancelled`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Session Cancelled</Text>
      <Text style={paragraph}>
        {cancelledBy === 'client'
          ? 'Your coaching session has been cancelled as requested.'
          : `Unfortunately, your coach ${coachName} has cancelled the upcoming session.`}
      </Text>

      <Section style={detailsContainer}>
        <Text style={sectionTitle}>Cancelled Session Details</Text>

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
            <Text style={label}>Original Price</Text>
          </Column>
          <Column style={valueColumn}>
            <Text style={value}>${price.toFixed(2)}</Text>
          </Column>
        </Row>
      </Section>

      {reason && (
        <Section style={reasonSection}>
          <Text style={reasonTitle}>Cancellation Reason</Text>
          <Text style={reasonText}>{reason}</Text>
        </Section>
      )}

      {refundAmount !== undefined && refundAmount > 0 && (
        <Section style={refundSection}>
          <Text style={refundTitle}>Refund Information</Text>
          <Text style={refundText}>{getRefundMessage()}</Text>
        </Section>
      )}

      <Text style={paragraph}>
        We understand plans can change. If you&apos;d like to reschedule,{' '}
        <Link href="https://accredipro-coachhub.com/coaches" style={link}>
          browse available coaches
        </Link>{' '}
        and book a new session at your convenience.
      </Text>

      <Text style={paragraph}>
        Questions about your cancellation?{' '}
        <Link href="https://accredipro-coachhub.com/support" style={link}>
          Contact our support team
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

const reasonSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
};

const reasonTitle = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
};

const reasonText = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const refundSection = {
  backgroundColor: '#dcfce7',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
};

const refundTitle = {
  color: '#4d2d30',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 8px',
};

const refundText = {
  color: '#4d2d30',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

export default CancellationEmail;
