'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface BookingResponseActionsProps {
  sessionId: number;
  clientName: string;
  variant?: 'default' | 'sidebar';
}

export function BookingResponseActions({
  sessionId,
  clientName,
  variant = 'default',
}: BookingResponseActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch(`/api/bookings/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Booking accepted',
          description: `The session with ${clientName} has been confirmed.`,
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || 'Failed to accept booking',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to accept booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/bookings/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reason: rejectReason.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Booking rejected',
          description: `The session request from ${clientName} has been rejected and the client will be refunded.`,
        });
        setRejectDialogOpen(false);
        setRejectReason('');
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || 'Failed to reject booking',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to reject booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  if (variant === 'sidebar') {
    return (
      <>
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start bg-[hsl(var(--brand-warm))] hover:bg-[hsl(var(--brand-accent-hover))]"
          onClick={handleAccept}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          {isAccepting ? 'Accepting...' : 'Accept Booking'}
        </Button>
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject Booking
            </Button>
          </DialogTrigger>
          <RejectDialogContent
            clientName={clientName}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            isRejecting={isRejecting}
            onReject={handleReject}
            onCancel={() => setRejectDialogOpen(false)}
          />
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="default"
        className="bg-[hsl(var(--brand-warm))] hover:bg-[hsl(var(--brand-accent-hover))]"
        onClick={handleAccept}
        disabled={isAccepting}
      >
        {isAccepting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-2 h-4 w-4" />
        )}
        {isAccepting ? 'Accepting...' : 'Accept Booking'}
      </Button>
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <XCircle className="mr-2 h-4 w-4" />
            Reject Booking
          </Button>
        </DialogTrigger>
        <RejectDialogContent
          clientName={clientName}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          isRejecting={isRejecting}
          onReject={handleReject}
          onCancel={() => setRejectDialogOpen(false)}
        />
      </Dialog>
    </div>
  );
}

function RejectDialogContent({
  clientName,
  rejectReason,
  setRejectReason,
  isRejecting,
  onReject,
  onCancel,
}: {
  clientName: string;
  rejectReason: string;
  setRejectReason: (value: string) => void;
  isRejecting: boolean;
  onReject: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Reject Booking Request</DialogTitle>
        <DialogDescription>
          Reject the session request from {clientName}. The client will be automatically refunded.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="flex items-start gap-3 rounded-md border border-gold/30 bg-gold/5 p-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold-dark" />
          <div className="text-sm">
            <p className="font-medium text-burgundy-dark">Refund Notice</p>
            <p className="mt-1 text-burgundy">
              The client&apos;s payment will be fully refunded when you reject this booking.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reject-reason">Reason (optional)</Label>
          <Textarea
            id="reject-reason"
            placeholder="Let the client know why you're declining this session..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="resize-none"
            rows={3}
            maxLength={500}
          />
          <p className="text-right text-xs text-muted-foreground">{rejectReason.length}/500</p>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} disabled={isRejecting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onReject} disabled={isRejecting} className="gap-2">
          {isRejecting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isRejecting ? 'Rejecting...' : 'Reject & Refund'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
