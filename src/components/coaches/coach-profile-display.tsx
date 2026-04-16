'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES, COACH_CATEGORIES } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';
import { Award, BadgeCheck, Calendar, Check, Clock, Copy, ExternalLink, Globe, User } from 'lucide-react';
import type { Credential } from '@/db/schema';
import { AvailabilitySection } from './availability-section';
import { MessageButton } from '@/components/messages';
import { ReviewsSection } from '@/components/reviews';
import { VerifiedBadge } from './verified-badge';

interface AvailabilityDisplayData {
  timezone: string | null;
  nextAvailable: string | null;
  nextAvailableDisplay: string | null;
  weeklyAvailabilitySummary: string | null;
  hasAvailability: boolean;
}

interface CoachProfileDisplayProps {
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  /** 2-level taxonomy: Array<{category, subNiches}> */
  specialties: Array<{ category: string; subNiches: string[] }> | null;
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
  // Credentials
  credentials?: Credential[] | null;
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
  credentials,
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
                  {specialties.flatMap((entry, entryIndex) => {
                    const cat = COACH_CATEGORIES.find((c) => c.label === entry.category);
                    if (entry.subNiches && entry.subNiches.length > 0) {
                      return entry.subNiches.map((subNiche, subIndex) => {
                        const subNicheData = cat?.subNiches.find((s) => s.label === subNiche);
                        const href =
                          cat && subNicheData
                            ? `/coaches/specialty/${subNicheData.slug}`
                            : null;
                        return href ? (
                          <Link key={`${entryIndex}-${subIndex}`} href={href}>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer text-sm hover:bg-secondary/80"
                            >
                              {subNiche}
                            </Badge>
                          </Link>
                        ) : (
                          <Badge
                            key={`${entryIndex}-${subIndex}`}
                            variant="secondary"
                            className="text-sm"
                          >
                            {subNiche}
                          </Badge>
                        );
                      });
                    }
                    const href = cat ? `/coaches/specialty/${cat.slug}` : null;
                    return [
                      href ? (
                        <Link key={entryIndex} href={href}>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer text-sm hover:bg-secondary/80"
                          >
                            {entry.category}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge key={entryIndex} variant="secondary" className="text-sm">
                          {entry.category}
                        </Badge>
                      ),
                    ];
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Credentials & Training Section */}
          {credentials && credentials.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-[hsl(var(--brand-warm))]" />
                  <CardTitle>Credentials & Training</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {credentials.map((cred) => (
                  <div key={cred.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{cred.title}</p>
                        {cred.verifiedAt && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            <BadgeCheck className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{cred.issuer}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                        {cred.type} · {cred.issuedYear}
                        {cred.expiresYear ? ` – ${cred.expiresYear}` : ''}
                      </p>
                      {cred.verificationUrl && (
                        <a
                          href={cred.verificationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-burgundy hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Verify credential
                        </a>
                      )}
                    </div>
                  </div>
                ))}
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
