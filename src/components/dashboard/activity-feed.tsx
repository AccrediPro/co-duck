'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  CalendarCheck,
  CalendarPlus,
  CheckCircle,
  MessageSquare,
  Star,
} from 'lucide-react';

interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
  link: string;
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  booking_created: CalendarPlus,
  booking_confirmed: CalendarCheck,
  booking_completed: CheckCircle,
  message_received: MessageSquare,
  review_received: Star,
  action_item_completed: CheckCircle,
};

const EVENT_COLORS: Record<string, string> = {
  booking_created: 'bg-gold/10 text-gold-dark',
  booking_confirmed: 'bg-burgundy/10 text-burgundy',
  booking_completed: 'bg-sage/10 text-sage',
  message_received: 'bg-burgundy/10 text-burgundy-light',
  review_received: 'bg-gold/10 text-gold-dark',
  action_item_completed: 'bg-sage/10 text-sage',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activity')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setEvents(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-full bg-burgundy/10 p-1.5">
            <Activity className="h-4 w-4 text-burgundy" />
          </div>
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Activity className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Your activity will appear here once you start getting bookings.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event, i) => {
              const Icon = EVENT_ICONS[event.type] ?? Activity;
              const colorClass = EVENT_COLORS[event.type] ?? 'bg-muted text-muted-foreground';
              return (
                <Link
                  key={`${event.type}-${event.timestamp}-${i}`}
                  href={event.link}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm">{event.description}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(event.timestamp)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
