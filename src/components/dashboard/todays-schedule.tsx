import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink } from 'lucide-react';
import { formatTime } from '@/lib/date-utils';
import type { DashboardSession } from '@/app/(dashboard)/dashboard/actions';

interface TodaysScheduleProps {
  sessions: DashboardSession[];
}

export function TodaysSchedule({ sessions }: TodaysScheduleProps) {
  const now = new Date();

  return (
    <Card className="border-t-4 border-t-burgundy">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <div className="rounded-full bg-burgundy/10 p-1.5">
            <Calendar className="h-5 w-5 text-burgundy" />
          </div>
          Today&apos;s Schedule
        </CardTitle>
        <Badge variant="secondary" className="bg-burgundy/10 text-burgundy">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </Badge>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Calendar className="mb-2 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No sessions today</p>
            <p className="mb-3 text-xs text-muted-foreground/70">
              Your schedule is clear for the day
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/availability">View Availability</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isNow = new Date(session.startTime) <= now && new Date(session.endTime) > now;
              const isPast = new Date(session.endTime) <= now;

              return (
                <div
                  key={session.id}
                  className={`flex items-center gap-4 rounded-lg border p-3 ${
                    isNow ? 'border-burgundy bg-burgundy/5' : ''
                  } ${isPast ? 'opacity-60' : ''}`}
                >
                  <div className="text-center">
                    <p className="text-sm font-semibold text-burgundy-dark">
                      {formatTime(session.startTime)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.sessionType.duration}min
                    </p>
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.clientAvatar || undefined} />
                    <AvatarFallback className="bg-burgundy/10 text-xs text-burgundy">
                      {session.clientName?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{session.clientName || 'Client'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.sessionType.name}
                    </p>
                  </div>
                  {isNow && (
                    <Badge className="bg-burgundy text-white hover:bg-burgundy-light">Now</Badge>
                  )}
                  {session.meetingLink && !isPast && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={session.meetingLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Join
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/dashboard/sessions?tab=upcoming`}>View</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
