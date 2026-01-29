'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, DollarSign, History, CalendarPlus, ExternalLink } from 'lucide-react';
import type { ClientContext } from '@/app/(dashboard)/dashboard/messages/[id]/actions';

interface ChatContextPanelProps {
  context: ClientContext;
}

// Get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Format price from cents
function formatPrice(cents: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF ',
    JPY: '\u00A5',
    INR: '\u20B9',
    MXN: 'MX$',
    BRL: 'R$',
  };
  const symbol = currencySymbols[currency] || '$';
  const amount = cents / 100;

  // No decimals for JPY
  if (currency === 'JPY') {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }

  return `${symbol}${amount.toFixed(2)}`;
}

// Format relative time
function formatSessionTime(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (diffDays === 1) {
    return `Tomorrow at ${format(date, 'h:mm a')}`;
  } else if (diffDays < 7) {
    return format(date, "EEEE 'at' h:mm a");
  } else {
    return format(date, "MMM d 'at' h:mm a");
  }
}

export function ChatContextPanel({ context }: ChatContextPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-l bg-muted/30">
      {/* Client Info Header */}
      <div className="flex flex-col items-center gap-3 border-b bg-background p-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={context.clientAvatar || undefined} />
          <AvatarFallback className="text-lg">{getInitials(context.clientName)}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h2 className="font-semibold">{context.clientName || 'Client'}</h2>
          <p className="text-sm text-muted-foreground">Client</p>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1 p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Stats
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-background">
            <CardContent className="flex items-center gap-2 p-3">
              <div className="rounded-full bg-primary/10 p-2">
                <History className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">{context.pastSessionsCount}</p>
                <p className="text-xs text-muted-foreground">Past Sessions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background">
            <CardContent className="flex items-center gap-2 p-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {formatPrice(context.totalSpentCents, context.currency)}
                </p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Upcoming Sessions */}
      <div className="flex-1 p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Upcoming Sessions
        </h3>
        {context.upcomingSessions.length === 0 ? (
          <Card className="bg-background">
            <CardContent className="flex flex-col items-center py-6 text-center">
              <Calendar className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No upcoming sessions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {context.upcomingSessions.map((session) => (
              <Card key={session.id} className="bg-background">
                <CardContent className="p-3">
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="block hover:opacity-80"
                  >
                    <p className="font-medium">{session.sessionTypeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSessionTime(session.startTime)}
                    </p>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Quick Links */}
      <div className="p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quick Links
        </h3>
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" className="justify-start" asChild>
            <Link href={`/coaches/${context.coachSlug}/book`}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Book Session
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="justify-start" asChild>
            <Link href={`/dashboard/sessions?client=${context.clientId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View All Sessions
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
