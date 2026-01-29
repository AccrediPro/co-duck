'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Globe, Mail } from 'lucide-react';

interface AvailabilitySectionProps {
  timezone: string | null;
  nextAvailable: string | null;
  nextAvailableDisplay: string | null;
  weeklyAvailabilitySummary: string | null;
  hasAvailability: boolean;
  slug: string;
}

export function AvailabilitySection({
  timezone,
  nextAvailableDisplay,
  weeklyAvailabilitySummary,
  hasAvailability,
  slug,
}: AvailabilitySectionProps) {
  if (!hasAvailability) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Availability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed bg-muted/50 p-4 text-center">
            <Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">Contact for Availability</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This coach hasn&apos;t set up their booking schedule yet. Please reach out directly to
              discuss availability.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timezone */}
        {timezone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>{timezone}</span>
          </div>
        )}

        {/* Next Available */}
        {nextAvailableDisplay && (
          <div className="rounded-lg border bg-primary/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next Available
            </p>
            <p className="mt-1 text-lg font-semibold text-primary">{nextAvailableDisplay}</p>
          </div>
        )}

        {/* Weekly Availability Summary */}
        {weeklyAvailabilitySummary && (
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" />
              General Hours
            </p>
            <p className="text-sm">{weeklyAvailabilitySummary}</p>
          </div>
        )}

        {/* Book Session Button */}
        <Button asChild className="w-full" size="lg">
          <Link href={`/coaches/${slug}/book`}>
            <Calendar className="mr-2 h-4 w-4" />
            Book Session
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
