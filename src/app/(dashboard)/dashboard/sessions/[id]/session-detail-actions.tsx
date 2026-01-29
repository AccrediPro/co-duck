'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import {
  cancelClientSession,
  generateClientIcsFile,
} from '@/app/(dashboard)/dashboard/my-sessions/actions';

interface SessionDetailActionsProps {
  sessionId: number;
  variant?: 'default' | 'sidebar';
}

export function SessionDetailActions({
  sessionId,
  variant = 'default',
}: SessionDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelClientSession(sessionId);

      if (result.success) {
        toast({
          title: 'Session cancelled',
          description: 'Your session has been cancelled successfully.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to cancel session',
          variant: 'destructive',
        });
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (variant === 'sidebar') {
    return (
      <>
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
          className="w-full justify-start text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          asChild
        >
          <Link href={`/dashboard/sessions/${sessionId}/reschedule`}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reschedule
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Cancel Session
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Session</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this session? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Session</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
                Cancel Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
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
        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
        asChild
      >
        <Link href={`/dashboard/sessions/${sessionId}/reschedule`}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reschedule
        </Link>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Cancel Session
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Session</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
              Cancel Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
