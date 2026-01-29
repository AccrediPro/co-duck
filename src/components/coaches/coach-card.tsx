'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';
import { User } from 'lucide-react';

interface CoachCardProps {
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  specialties: string[] | null;
  sessionTypes: SessionType[] | null;
  currency: string | null;
  slug: string;
}

export function CoachCard({
  name,
  avatarUrl,
  headline,
  specialties,
  sessionTypes,
  currency,
  slug,
}: CoachCardProps) {
  const currencyData = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const currencySymbol = currencyData?.symbol || '$';

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(0);
  };

  const getInitials = (displayName: string) => {
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get the lowest priced session for display
  const lowestPricedSession =
    sessionTypes && sessionTypes.length > 0
      ? sessionTypes.reduce((min, session) => (session.price < min.price ? session : min))
      : null;

  // Limit specialties to display (max 3)
  const displaySpecialties = specialties?.slice(0, 3) || [];
  const hasMoreSpecialties = (specialties?.length || 0) > 3;

  return (
    <Link href={`/coaches/${slug}`}>
      <Card className="group h-full cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <Avatar className="h-20 w-20 border-2 border-background shadow-md">
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className="text-lg">
                {name ? getInitials(name) : <User className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <h3 className="mt-4 text-lg font-semibold transition-colors group-hover:text-primary">
              {name}
            </h3>

            {/* Headline */}
            {headline && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{headline}</p>
            )}

            {/* Specialties */}
            {displaySpecialties.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1">
                {displaySpecialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {hasMoreSpecialties && (
                  <Badge variant="outline" className="text-xs">
                    +{(specialties?.length || 0) - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Starting Price */}
            {lowestPricedSession && (
              <div className="mt-4 w-full border-t pt-4">
                <p className="text-sm text-muted-foreground">Starting from</p>
                <p className="text-xl font-bold text-primary">
                  {currencySymbol}
                  {formatPrice(lowestPricedSession.price)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
