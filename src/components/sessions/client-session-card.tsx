'use client';

import Link from 'next/link';
import { formatDateLong, formatTime } from '@/lib/date-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  XCircle,
  Eye,
  CalendarPlus,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import { CancellationDialog } from './cancellation-dialog';
import type { RefundEligibilityInfo } from './cancellation-dialog';
import type {
  SessionWithCoach,
  PaymentStatus,
} from '@/app/(dashboard)/dashboard/my-sessions/actions';

interface ClientSessionCardProps {
  session: SessionWithCoach;
  onCancel?: (sessionId: number, reason: string, details: string) => Promise<void>;
  onAddToCalendar?: (sessionId: number) => Promise<void>;
  onPayNow?: (sessionId: number) => void;
  isUpcoming?: boolean;
  refundInfo?: RefundEligibilityInfo;
}

export function ClientSessionCard({
  session,
  onCancel,
  onAddToCalendar,
  onPayNow,
  isUpcoming = false,
  refundInfo,
}: ClientSessionCardProps) {
  const getInitials = (name: string | null) => {
    if (!name) return 'C';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  const getPaymentBadge = (status: PaymentStatus, price: number) => {
    // No badge for free sessions
    if (status === 'free' || price === 0) return null;

    switch (status) {
      case 'paid':
        return (
          <Badge variant="outline" className="border-sage bg-sage/10 text-sage">
            <CreditCard className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case 'payment_required':
        return (
          <Badge variant="secondary" className="bg-gold/15 text-gold-dark">
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

  const canCancel = isUpcoming && session.status !== 'cancelled';
  const canReschedule = isUpcoming && session.status !== 'cancelled';
  const canPayNow =
    isUpcoming &&
    session.sessionType.price > 0 &&
    (session.paymentStatus === 'payment_required' || session.paymentStatus === 'payment_failed');

  return (
    <Card className="transition-all hover:border-burgundy/30 hover:shadow-md">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Coach info and session details */}
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={session.coachAvatar || undefined} alt={session.coachName || ''} />
              <AvatarFallback>
                {session.coachName ? getInitials(session.coachName) : <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{session.coachName || 'Coach'}</h3>
                <StatusBadge status={session.status} />
                {getPaymentBadge(session.paymentStatus, session.sessionType.price)}
              </div>

              <p className="mt-1 text-sm font-medium text-burgundy">{session.sessionType.name}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateLong(session.startTime)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(session.startTime)} -{' '}
                  {formatTime(session.endTime)}
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

            {isUpcoming && onAddToCalendar && (
              <Button variant="outline" size="sm" onClick={() => onAddToCalendar(session.id)}>
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                Add to Calendar
              </Button>
            )}

            {canPayNow && onPayNow && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onPayNow(session.id)}
                className="bg-burgundy text-white hover:bg-burgundy-light"
              >
                <CreditCard className="mr-1.5 h-4 w-4" />
                Pay Now
              </Button>
            )}

            {canReschedule && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-burgundy hover:bg-burgundy/5 hover:text-burgundy-light"
              >
                <Link href={`/dashboard/sessions/${session.id}/reschedule`}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Reschedule
                </Link>
              </Button>
            )}

            {canCancel && onCancel && (
              <CancellationDialog
                onCancel={(reason, details) => onCancel(session.id, reason, details)}
                otherPartyName={session.coachName || 'the coach'}
                sessionTime={session.startTime}
                isCoach={false}
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
