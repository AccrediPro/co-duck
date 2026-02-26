'use client';

import Link from 'next/link';
import { CalendarDays, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Coach {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  profile: {
    headline: string | null;
    slug: string | null;
    specialties: string[] | null;
  } | null;
  lastBookingDate: string;
  totalSessions: number;
  activeProgramsCount: number;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function MyCoachesList({ coaches }: { coaches: Coach[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {coaches.map((coach) => (
        <Link key={coach.id} href={`/dashboard/my-coaches/${coach.id}`}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={coach.avatarUrl || undefined} alt={coach.name || 'Coach'} />
                  <AvatarFallback>{getInitials(coach.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{coach.name || 'Coach'}</h3>
                  {coach.profile?.headline && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {coach.profile.headline}
                    </p>
                  )}
                </div>
              </div>

              {coach.profile?.specialties && coach.profile.specialties.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {coach.profile.specialties.slice(0, 3).map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                  {coach.profile.specialties.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{coach.profile.specialties.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {coach.totalSessions} session{coach.totalSessions !== 1 ? 's' : ''}
                </span>
                {coach.activeProgramsCount > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {coach.activeProgramsCount} active program
                    {coach.activeProgramsCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {coach.lastBookingDate && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last session: {format(new Date(coach.lastBookingDate), 'MMM d, yyyy')}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
