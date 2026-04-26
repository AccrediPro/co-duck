'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientCheckIn {
  userId: string;
  name: string;
  avatar: string | null;
  mood: 'good' | 'okay' | 'struggling' | null;
  note: string | null;
  respondedAt: string | null;
  weekNumber: number;
  currentStreak: number;
}

const MOOD_DISPLAY = {
  good: { emoji: '😊', label: 'Good', badgeClass: 'bg-sage/15 text-sage border-sage/30' },
  okay: { emoji: '😐', label: 'Okay', badgeClass: 'bg-gold/15 text-gold-dark border-gold/30' },
  struggling: {
    emoji: '😔',
    label: 'Struggling',
    badgeClass: 'bg-burgundy/15 text-burgundy border-burgundy/30',
  },
} as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function CheckInOverview() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientCheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/check-ins/clients')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setClients(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-burgundy-dark">Client Check-ins</CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <ClipboardCheck className="mb-2 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No check-ins this week</p>
            <p className="text-xs text-muted-foreground/70">Client check-ins will appear here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {clients.map((client) => {
              const moodInfo = client.mood ? MOOD_DISPLAY[client.mood] : null;
              return (
                <button
                  key={client.userId}
                  type="button"
                  onClick={() => router.push(`/dashboard/clients/${client.userId}`)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50',
                    client.mood === 'struggling' && 'bg-burgundy/5'
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-sm font-medium text-burgundy">
                    {getInitials(client.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{client.name}</span>
                      {client.currentStreak > 0 && (
                        <span className="text-xs text-muted-foreground">
                          🔥 {client.currentStreak}
                        </span>
                      )}
                    </div>
                    {client.note && (
                      <p className="truncate text-xs text-muted-foreground">{client.note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {moodInfo ? (
                      <Badge variant="outline" className={moodInfo.badgeClass}>
                        {moodInfo.emoji} {moodInfo.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pending
                      </Badge>
                    )}
                    {client.respondedAt && (
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(client.respondedAt)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
