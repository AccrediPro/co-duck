'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, Video, Loader2 } from 'lucide-react';
import { CancellationDialog } from '@/components/sessions/cancellation-dialog';
import { generateCoachIcsFile, cancelSession } from '../actions';

interface CoachSessionActionsProps {
  sessionId: number;
  canCancel: boolean;
  clientName?: string;
  sessionTime?: Date;
  variant?: 'default' | 'sidebar';
}

export function CoachSessionActions({
  sessionId,
  canCancel,
  clientName = 'the client',
  sessionTime,
  variant = 'default',
}: CoachSessionActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  const handleAddToCalendar = async () => {
    setIsAddingToCalendar(true);
    try {
      const result = await generateCoachIcsFile(sessionId);

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

  const handleJoinSession = () => {
    toast({
      title: 'Video integration coming soon',
      description: 'The video session feature is currently under development.',
    });
  };

  const handleCancel = async (reason: string, details: string) => {
    const fullReason = details ? `${reason}: ${details}` : reason;
    const result = await cancelSession(sessionId, fullReason);

    if (result.success) {
      toast({
        title: 'Session cancelled',
        description: 'The session has been cancelled successfully.',
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
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start"
          onClick={handleJoinSession}
        >
          <Video className="mr-2 h-4 w-4" />
          Join Session
        </Button>
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
        {canCancel && (
          <CancellationDialog
            onCancel={handleCancel}
            otherPartyName={clientName}
            sessionTime={sessionTime}
            isCoach={true}
            variant="sidebar"
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="default" onClick={handleJoinSession}>
        <Video className="mr-2 h-4 w-4" />
        Join Session
      </Button>
      <Button variant="outline" onClick={handleAddToCalendar} disabled={isAddingToCalendar}>
        {isAddingToCalendar ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CalendarPlus className="mr-2 h-4 w-4" />
        )}
        Add to Calendar
      </Button>
      {canCancel && (
        <CancellationDialog
          onCancel={handleCancel}
          otherPartyName={clientName}
          sessionTime={sessionTime}
          isCoach={true}
        />
      )}
    </div>
  );
}
