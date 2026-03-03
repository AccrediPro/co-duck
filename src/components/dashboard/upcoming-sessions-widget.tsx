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

export function UpcomingSessionsWidget({ sessions }: UpcomingSessionsWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
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
          <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.clientAvatar || undefined} />
                  <AvatarFallback>{session.clientName?.charAt(0) || 'C'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session.clientName || 'Client'}</p>
                  <p className="text-xs text-muted-foreground">{session.sessionType.name}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {getRelativeTime(new Date(session.startTime))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
