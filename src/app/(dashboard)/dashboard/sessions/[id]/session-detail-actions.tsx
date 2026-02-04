'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, RefreshCw, Loader2 } from 'lucide-react';
import { CancellationDialog } from '@/components/sessions/cancellation-dialog';
import type { RefundEligibilityInfo } from '@/components/sessions/cancellation-dialog';
import { MessageButton } from '@/components/messages';
import {
  cancelClientSession,
  generateClientIcsFile,
  getClientRefundEligibility,
} from '@/app/(dashboard)/dashboard/my-sessions/actions';

interface SessionDetailActionsProps {
  sessionId: number;
  coachId: string;
  clientId: string;
  coachName?: string;
  sessionTime?: Date;
  variant?: 'default' | 'sidebar';
  hasPaidTransaction?: boolean;
}

export function SessionDetailActions({
  sessionId,
  coachId,
  clientId,
  coachName = 'the coach',
  sessionTime,
  variant = 'default',
  hasPaidTransaction = false,
}: SessionDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [refundInfo, setRefundInfo] = useState<RefundEligibilityInfo | undefined>();

  // Load refund info if there's a paid transaction
  useEffect(() => {
    if (hasPaidTransaction) {
      getClientRefundEligibility(sessionId).then((result) => {
        if (result.success && result.data) {
          setRefundInfo({
            hasPaidTransaction: result.data.hasPaidTransaction,
            isEligibleForRefund: result.data.isEligibleForRefund,
            refundAmountFormatted: result.data.refundAmountFormatted,
            refundReason: result.data.refundReason,
          });
        }
      });
    }
  }, [hasPaidTransaction, sessionId]);

  const handleAddToCalendar = async () => {
    setIsAddingToCalendar(true);
    try {
      const result = await generateClientIcsFile(sessionId);

      if (result.success) {
        // Create a download link for the ICS file
        const blob = new Blob([result.data], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `coaching-session-${sessionId}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Calendar file downloaded',
          description: 'Open the downloaded file to add this session to your calendar.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to generate calendar file',
          variant: 'destructive',
        });
      }
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleCancel = async (reason: string, details: string) => {
    const fullReason = details ? `${reason}: ${details}` : reason;
    const result = await cancelClientSession(sessionId, fullReason);

    if (result.success) {
      let description = 'Your session has been cancelled successfully.';
      if (result.refund?.wasRefunded) {
        description = `Session cancelled. You will receive a refund of ${result.refund.refundAmountFormatted}.`;
      } else if (result.refund && !result.refund.wasRefunded && result.refund.reason) {
        description = `Session cancelled. ${result.refund.reason}`;
      }

      toast({
        title: 'Session cancelled',
        description,
      });
      router.refresh();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to cancel session',
        variant: 'destructive',
      });
    }
  };

  if (variant === 'sidebar') {
    return (
      <>
        <MessageButton
          coachId={coachId}
          clientId={clientId}
          variant="outline"
          size="sm"
          className="w-full justify-start"
          label="Message Coach"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleAddToCalendar}
          disabled={isAddingToCalendar}
        >
          {isAddingToCalendar ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="mr-2 h-4 w-4" />
          )}
          Add to Calendar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
          asChild
        >
          <Link href={`/dashboard/sessions/${sessionId}/reschedule`}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reschedule
          </Link>
        </Button>
        <CancellationDialog
          onCancel={handleCancel}
          otherPartyName={coachName}
          sessionTime={sessionTime}
          isCoach={false}
          variant="sidebar"
          refundInfo={refundInfo}
        />
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <MessageButton
        coachId={coachId}
        clientId={clientId}
        variant="outline"
        label="Message Coach"
      />
      <Button variant="outline" onClick={handleAddToCalendar} disabled={isAddingToCalendar}>
        {isAddingToCalendar ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CalendarPlus className="mr-2 h-4 w-4" />
        )}
        Add to Calendar
      </Button>
      <Button
        variant="outline"
        className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        asChild
      >
        <Link href={`/dashboard/sessions/${sessionId}/reschedule`}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reschedule
        </Link>
      </Button>
      <CancellationDialog
        onCancel={handleCancel}
        otherPartyName={coachName}
        sessionTime={sessionTime}
        isCoach={false}
        refundInfo={refundInfo}
      />
    </div>
  );
}
