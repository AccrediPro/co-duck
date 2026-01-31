/**
 * @fileoverview Client context panel for the chat sidebar (coach view only).
 *
 * This panel provides coaches with helpful information about the client they're
 * messaging, including relationship stats, upcoming sessions, action items,
 * and quick links.
 *
 * ## Sections
 *
 * 1. **Client Info** - Avatar, name, role label
 * 2. **Stats** - Past sessions count, total spent
 * 3. **Upcoming Sessions** - Next 3 scheduled sessions (clickable)
 * 4. **Action Items** - Pending/completed tasks with add capability
 * 5. **Quick Links** - Book Session, View All Sessions
 *
 * ## Responsive Behavior
 *
 * - Desktop: Visible as a sidebar on the right
 * - Mobile: Hidden, accessed via sheet/slide-out panel
 *
 * @module components/messages/chat-context-panel
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  DollarSign,
  History,
  CalendarPlus,
  ExternalLink,
  CheckSquare,
} from 'lucide-react';
import type { ClientContext } from '@/app/(dashboard)/dashboard/messages/[id]/actions';
import { ActionItemsList, AddActionItemDialog } from '@/components/action-items';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the ChatContextPanel component.
 *
 * @property context - Client context data from getClientContext action
 */
interface ChatContextPanelProps {
  context: ClientContext;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract initials from a user's name for avatar fallback.
 *
 * @param name - Full name (e.g., "John Doe")
 * @returns Initials (e.g., "JD") or "?" if name is null/empty
 */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Format a price from cents to display string with currency symbol.
 *
 * Handles multiple currencies with appropriate symbols.
 * Special handling for JPY (no decimals).
 *
 * @param cents - Amount in cents
 * @param currency - ISO currency code (e.g., "USD", "EUR")
 * @returns Formatted price string (e.g., "$45.00", "€40.00", "¥5000")
 */
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

/**
 * Format an upcoming session time in a human-friendly way.
 *
 * Output examples:
 * - Same day: "Today at 2:30 PM"
 * - Tomorrow: "Tomorrow at 10:00 AM"
 * - This week: "Thursday at 3:00 PM"
 * - Further out: "Feb 15 at 1:00 PM"
 *
 * @param date - Session start time
 * @returns Formatted time string
 */
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

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Sidebar panel showing client context for coaches during chat.
 *
 * Displays client stats, upcoming sessions, action items, and quick links
 * to help coaches have context about their client relationship.
 *
 * @param props - Component props with ClientContext data
 * @returns Context panel JSX
 *
 * @example
 * // In ChatView (conditional on isCoach)
 * {conversation.isCoach && clientContext && (
 *   <ChatContextPanel context={clientContext} />
 * )}
 */
export function ChatContextPanel({ context }: ChatContextPanelProps) {
  const router = useRouter();
  const [, setRefreshKey] = useState(0);

  const handleActionItemUpdate = useCallback(() => {
    // Force a refresh to reload the action items
    setRefreshKey((prev) => prev + 1);
    router.refresh();
  }, [router]);

  // Prepare action items for the list component
  const actionItemsForList = (context.actionItems || []).map((item) => ({
    ...item,
    // Ensure dates are properly typed
    completedAt: item.completedAt ? new Date(item.completedAt) : null,
    createdAt: new Date(item.createdAt),
  }));

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

      {/* Action Items */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Action Items
          </h3>
          <AddActionItemDialog
            clientId={context.clientId}
            clientName={context.clientName || undefined}
            onActionItemAdded={handleActionItemUpdate}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
          />
        </div>
        {actionItemsForList.length === 0 ? (
          <Card className="bg-background">
            <CardContent className="flex flex-col items-center py-6 text-center">
              <CheckSquare className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No action items</p>
            </CardContent>
          </Card>
        ) : (
          <ActionItemsList
            items={actionItemsForList}
            onUpdate={handleActionItemUpdate}
            showDelete={true}
            compact={true}
          />
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
