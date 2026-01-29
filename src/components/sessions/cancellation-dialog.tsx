'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';

export const CANCELLATION_REASONS = [
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'other', label: 'Other' },
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]['value'];

interface CancellationDialogProps {
  onCancel: (reason: string, details: string) => Promise<void>;
  otherPartyName: string;
  sessionTime?: Date;
  /** Reserved for future use when coach/client have different policies */
  isCoach?: boolean;
  triggerButton?: React.ReactNode;
  variant?: 'default' | 'sidebar';
}

export function CancellationDialog({
  onCancel,
  otherPartyName,
  sessionTime,
  isCoach: _isCoach = false,
  triggerButton,
  variant = 'default',
}: CancellationDialogProps) {
  // _isCoach is reserved for future use (different policies for coach/client)
  void _isCoach;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [details, setDetails] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Check if session is within 24 hours
  const isWithin24Hours = sessionTime
    ? new Date(sessionTime).getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false;

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const reasonLabel =
        CANCELLATION_REASONS.find((r) => r.value === reason)?.label || reason || 'Not specified';
      await onCancel(reasonLabel, details);
      setOpen(false);
      // Reset form
      setReason('');
      setDetails('');
    } finally {
      setIsCancelling(false);
    }
  };

  const defaultTrigger =
    variant === 'sidebar' ? (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <XCircle className="mr-2 h-4 w-4" />
        Cancel Session
      </Button>
    ) : (
      <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700">
        <XCircle className="mr-2 h-4 w-4" />
        Cancel Session
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancel Session</DialogTitle>
          <DialogDescription>
            Cancel your session with {otherPartyName}. Please let us know why you&apos;re
            cancelling.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Cancellation Policy Warning */}
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Cancellation Policy</p>
              <p className="mt-1 text-amber-700">
                {isWithin24Hours ? (
                  <>
                    This session is within 24 hours. Cancellations made less than 24 hours before
                    the scheduled time may be subject to cancellation fees.
                  </>
                ) : (
                  <>
                    Sessions cancelled with at least 24 hours notice can be rescheduled at no
                    additional cost. Late cancellations may be subject to fees.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Reason Dropdown */}
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason for cancellation</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CancellationReason)}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Details */}
          <div className="grid gap-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Please share any additional information..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">{details.length}/500</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCancelling}>
            Keep Session
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isCancelling}
            className="gap-2"
          >
            {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCancelling ? 'Cancelling...' : 'Cancel Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
