import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, ArrowRight, ExternalLink } from 'lucide-react';
import type { DashboardSession } from '@/app/(dashboard)/dashboard/actions';

interface ClientUpcomingSessionsProps {
  sessions: Array<DashboardSession & { coachSlug: string }>;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'starting soon';
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ClientUpcomingSessions({ sessions }: ClientUpcomingSessionsProps) {
  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Sessions
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/my-sessions">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
            <Button size="sm" asChild>
              <Link href="/coaches">Find a Coach</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const now = new Date();
              const isNow = new Date(session.startTime) <= now && new Date(session.endTime) > now;

              return (
                <div
                  key={session.id}
                  className={`flex items-center gap-4 rounded-lg border p-3 ${
                    isNow ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : ''
                  }`}
                >
                  <div className="min-w-[60px] text-center">
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.startTime).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-sm font-semibold">
                      {new Date(session.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </p>
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.coachAvatar || undefined} />
                    <AvatarFallback>{session.coachName?.charAt(0) || 'C'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{session.coachName || 'Coach'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.sessionType.name} ({session.sessionType.duration}min)
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {getRelativeTime(new Date(session.startTime))}
                  </span>
                  {session.meetingLink && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={session.meetingLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Join
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
