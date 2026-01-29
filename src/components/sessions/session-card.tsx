'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, CheckCircle, XCircle, Eye, CreditCard } from 'lucide-react';
import { CancellationDialog } from './cancellation-dialog';
import type { RefundEligibilityInfo } from './cancellation-dialog';
import type {
  SessionWithClient,
  PaymentStatus,
} from '@/app/(dashboard)/dashboard/sessions/actions';

interface SessionCardProps {
  session: SessionWithClient;
  onMarkComplete?: (sessionId: number) => Promise<void>;
  onCancel?: (sessionId: number, reason: string, details: string) => Promise<void>;
  isPast?: boolean;
  isCancelled?: boolean;
  refundInfo?: RefundEligibilityInfo;
}

export function SessionCard({
  session,
  onMarkComplete,
  onCancel,
  isPast = false,
  isCancelled = false,
  refundInfo,
}: SessionCardProps) {
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = () => {
    switch (session.status) {
      case 'confirmed':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            Confirmed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="border-green-500 text-green-600">
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-600 hover:bg-red-200">
            Cancelled
          </Badge>
        );
      case 'no_show':
        return (
          <Badge variant="outline" className="border-gray-400 text-gray-500">
            No Show
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPaymentBadge = (status: PaymentStatus, price: number) => {
    // No badge for free sessions
    if (status === 'free' || price === 0) return null;

    switch (status) {
      case 'paid':
        return (
          <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">
            <CreditCard className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case 'payment_required':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            <CreditCard className="mr-1 h-3 w-3" />
            Payment Required
          </Badge>
        );
      case 'payment_failed':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-700">
            <CreditCard className="mr-1 h-3 w-3" />
            Payment Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <Card className="transition-all hover:border-primary/30 hover:shadow-md">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Client info and session details */}
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={session.clientAvatar || undefined} alt={session.clientName || ''} />
              <AvatarFallback>
                {session.clientName ? (
                  getInitials(session.clientName)
                ) : (
                  <User className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{session.clientName || 'Unknown Client'}</h3>
                {getStatusBadge()}
                {getPaymentBadge(session.paymentStatus, session.sessionType.price)}
              </div>

              <p className="mt-1 text-sm font-medium text-primary">{session.sessionType.name}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(session.startTime), 'EEE, MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(session.startTime), 'h:mm a')} -{' '}
                  {format(new Date(session.endTime), 'h:mm a')}
                </span>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {session.sessionType.duration} min - {formatPrice(session.sessionType.price)}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/sessions/${session.id}`}>
                <Eye className="mr-1.5 h-4 w-4" />
                View
              </Link>
            </Button>

            {isPast &&
              !isCancelled &&
              session.status !== 'completed' &&
              session.status !== 'no_show' &&
              onMarkComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMarkComplete(session.id)}
                  className="text-green-600 hover:bg-green-50 hover:text-green-700"
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Complete
                </Button>
              )}

            {!isCancelled &&
              session.status !== 'completed' &&
              session.status !== 'cancelled' &&
              onCancel && (
                <CancellationDialog
                  onCancel={(reason, details) => onCancel(session.id, reason, details)}
                  otherPartyName={session.clientName || 'the client'}
                  sessionTime={session.startTime}
                  isCoach={true}
                  refundInfo={refundInfo}
                  triggerButton={
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Cancel
                    </Button>
                  }
                />
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
