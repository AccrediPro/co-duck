'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';
import { Calendar, Check, Clock, Copy, Globe, Repeat, User } from 'lucide-react';
import { AvailabilitySection } from './availability-section';
import { MessageButton } from '@/components/messages';
import { ReviewsSection } from '@/components/reviews';
import { VerifiedBadge } from './verified-badge';
import { SubscribeButton } from '@/components/memberships/subscribe-button';

interface AvailabilityDisplayData {
  timezone: string | null;
  nextAvailable: string | null;
  nextAvailableDisplay: string | null;
  weeklyAvailabilitySummary: string | null;
  hasAvailability: boolean;
}

interface MembershipSummary {
  id: number;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  currency: string;
  sessionsPerPeriod: number;
  includesMessaging: boolean;
}

interface CoachProfileDisplayProps {
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  specialties: string[] | null;
  timezone: string | null;
  hourlyRate: number | null;
  currency: string | null;
  sessionTypes: SessionType[] | null;
  slug: string;
  availability?: AvailabilityDisplayData;
  // For messaging - only show if user is logged in and not viewing their own profile
  coachId?: string;
  currentUserId?: string | null;
  // Verification status
  isVerified?: boolean;
  // Recurring memberships offered by this coach (may be empty)
  memberships?: MembershipSummary[];
  /** True if the signed-in viewer already has an active/past_due sub with this coach. */
  currentUserHasActiveSubscription?: boolean;
}

export function CoachProfileDisplay({
  name,
  avatarUrl,
  headline,
  bio,
  specialties,
  timezone,
  hourlyRate,
  currency,
  sessionTypes,
  slug,
  availability,
  coachId,
  currentUserId,
  isVerified,
  memberships: coachMemberships,
  currentUserHasActiveSubscription,
}: CoachProfileDisplayProps) {
  // Show message button only if user is logged in and not viewing their own profile
  const canMessage = currentUserId && coachId && currentUserId !== coachId;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const currencyData = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const currencySymbol = currencyData?.symbol || '$';

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const getInitials = (displayName: string) => {
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleShareProfile = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link Copied!',
        description: 'Profile URL has been copied to your clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Could not copy the link. Please copy the URL manually.',
      });
    }
  };

  // Get the lowest priced session for display
  const lowestPricedSession =
    sessionTypes && sessionTypes.length > 0
      ? sessionTypes.reduce((min, session) => (session.price < min.price ? session : min))
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero Section */}
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <Avatar className="h-28 w-28 border-4 border-background shadow-lg sm:h-32 sm:w-32">
              <AvatarImage src={avatarUrl || undefined} alt={name} />
              <AvatarFallback className="text-2xl">
                {name ? getInitials(name) : <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
                {isVerified && <VerifiedBadge size="lg" />}
              </div>
              {headline && (
                <p className="mt-1 text-lg text-muted-foreground sm:text-xl">{headline}</p>
              )}
              {timezone && (
                <p className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground sm:justify-start">
                  <Globe className="h-4 w-4" />
                  {timezone}
                </p>
              )}

              {/* CTA Buttons - Mobile */}
              <div className="mt-4 flex flex-col gap-2 sm:hidden">
                <Button size="lg" asChild className="w-full">
                  <Link href={`/coaches/${slug}/book`}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Book Session
                  </Link>
                </Button>
                {canMessage && (
                  <MessageButton
                    coachId={coachId}
                    clientId={currentUserId}
                    variant="outline"
                    size="lg"
                    fullWidth
                    label="Message"
                  />
                )}
                <Button variant="outline" size="lg" onClick={handleShareProfile} className="w-full">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Share Profile
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* CTA Buttons - Desktop */}
            <div className="hidden flex-col gap-2 sm:flex">
              <Button size="lg" asChild>
                <Link href={`/coaches/${slug}/book`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Book Session
                </Link>
              </Button>
              {canMessage && (
                <MessageButton
                  coachId={coachId}
                  clientId={currentUserId}
                  variant="outline"
                  size="lg"
                  label="Message"
                />
              )}
              <Button variant="outline" size="lg" onClick={handleShareProfile}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Share Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* About Section */}
          {bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Specialties Section */}
          {specialties && specialties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Specialties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((specialty, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ongoing Coaching (Memberships) */}
          {coachMemberships && coachMemberships.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-5 w-5" />
                  Ongoing coaching
                </CardTitle>
                <CardDescription>
                  Monthly retainers for clients who want ongoing support.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {coachMemberships.map((m) => {
                  const price = (m.monthlyPriceCents / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  return (
                    <div key={m.id} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold">{m.name}</h4>
                          {m.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                          )}
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <li>
                              {m.sessionsPerPeriod > 0
                                ? `${m.sessionsPerPeriod} session${
                                    m.sessionsPerPeriod === 1 ? '' : 's'
                                  } per month`
                                : 'Messaging-only tier'}
                            </li>
                            {m.includesMessaging && <li>Unlimited messaging</li>}
                          </ul>
                        </div>
                        <div className="sm:text-right">
                          <div className="text-xl font-bold">
                            {m.currency.toUpperCase() === 'USD' ? '$' : ''}
                            {price}
                            <span className="ml-1 text-sm font-normal text-muted-foreground">
                              /month
                            </span>
                          </div>
                          <p className="text-xs uppercase text-muted-foreground">{m.currency}</p>
                          <div className="mt-3">
                            <SubscribeButton
                              membershipId={m.id}
                              coachId={coachId || ''}
                              currentUserId={currentUserId ?? null}
                              alreadySubscribed={!!currentUserHasActiveSubscription}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Reviews Section */}
          <ReviewsSection slug={slug} />
        </div>

        {/* Sidebar - Availability & Pricing */}
        <div className="space-y-6">
          {/* Availability Section */}
          {availability && (
            <AvailabilitySection
              timezone={availability.timezone}
              nextAvailable={availability.nextAvailable}
              nextAvailableDisplay={availability.nextAvailableDisplay}
              weeklyAvailabilitySummary={availability.weeklyAvailabilitySummary}
              hasAvailability={availability.hasAvailability}
              slug={slug}
            />
          )}

          {/* Sessions & Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Sessions & Pricing</CardTitle>
              {lowestPricedSession && (
                <CardDescription>
                  Starting from {currencySymbol}
                  {formatPrice(lowestPricedSession.price)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionTypes && sessionTypes.length > 0 ? (
                <>
                  {sessionTypes.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{session.name}</h4>
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {session.duration} minutes
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">
                            {currencySymbol}
                            {formatPrice(session.price)}
                          </p>
                          <p className="text-xs text-muted-foreground">{currency}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <Button asChild className="w-full" size="lg">
                    <Link href={`/coaches/${slug}/book`}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Book a Session
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No session types available at this time.
                </p>
              )}

              {hourlyRate && hourlyRate > 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Base hourly rate: {currencySymbol}
                  {formatPrice(hourlyRate)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Share Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Share this profile</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleShareProfile} className="w-full">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Profile Link
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
