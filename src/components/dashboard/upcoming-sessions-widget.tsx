import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, ArrowRight } from 'lucide-react';
import { formatDateShort } from '@/lib/date-utils';
import type { DashboardSession } from '@/app/(dashboard)/dashboard/actions';

interface UpcomingSessionsWidgetProps {
  sessions: DashboardSession[];
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return formatDateShort(date);
}

function getTimeUrgency(date: Date): 'imminent' | 'soon' | 'normal' {
  const diffMs = date.getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return 'imminent';
  if (diffHours < 24) return 'soon';
  return 'normal';
}

const urgencyStyles = {
  imminent: 'text-burgundy font-semibold',
  soon: 'text-gold-dark',
  normal: 'text-muted-foreground',
};

export function UpcomingSessionsWidget({ sessions }: UpcomingSessionsWidgetProps) {
  return (
    <Card className="border-t-4 border-t-burgundy/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-full bg-burgundy/10 p-1.5">
            <Clock className="h-4 w-4 text-burgundy" />
          </div>
          Upcoming Sessions
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/sessions">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Clock className="mb-2 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No upcoming sessions</p>
            <p className="mb-3 text-xs text-muted-foreground/70">
              Sessions will appear here once booked
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/sessions">View Sessions</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const urgency = getTimeUrgency(new Date(session.startTime));
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.clientAvatar || undefined} />
                    <AvatarFallback className="bg-burgundy/10 text-xs text-burgundy">
                      {session.clientName?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{session.clientName || 'Client'}</p>
                    <p className="text-xs text-muted-foreground">{session.sessionType.name}</p>
                  </div>
                  <span className={`whitespace-nowrap text-xs ${urgencyStyles[urgency]}`}>
                    {getRelativeTime(new Date(session.startTime))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
