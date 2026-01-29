'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { Calendar, Clock, User, XCircle, Eye, CalendarPlus, RefreshCw } from 'lucide-react';
import type { SessionWithCoach } from '@/app/(dashboard)/dashboard/my-sessions/actions';

interface ClientSessionCardProps {
  session: SessionWithCoach;
  onCancel?: (sessionId: number) => Promise<void>;
  onAddToCalendar?: (sessionId: number) => Promise<void>;
  isUpcoming?: boolean;
}

export function ClientSessionCard({
  session,
  onCancel,
  onAddToCalendar,
  isUpcoming = false,
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

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const canCancel = isUpcoming && session.status !== 'cancelled';
  const canReschedule = isUpcoming && session.status !== 'cancelled';

  return (
    <Card className="transition-all hover:border-primary/30 hover:shadow-md">
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
                {getStatusBadge()}
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

            {isUpcoming && onAddToCalendar && (
              <Button variant="outline" size="sm" onClick={() => onAddToCalendar(session.id)}>
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                Add to Calendar
              </Button>
            )}

            {canReschedule && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              >
                <Link href={`/dashboard/sessions/${session.id}/reschedule`}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Reschedule
                </Link>
              </Button>
            )}

            {canCancel && onCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Session</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this session with {session.coachName}? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Session</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onCancel(session.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Cancel Session
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
