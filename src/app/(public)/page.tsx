import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db, coachProfiles, users } from '@/db';

// This page queries the DB at request time; skip static prerender (CI has no DB).
export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';
import { ArrowRight, User, BadgeCheck, Heart, Lock } from 'lucide-react';

async function getFeaturedCoaches() {
  try {
    const coaches = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
        headline: coachProfiles.headline,
        specialties: coachProfiles.specialties,
        sessionTypes: coachProfiles.sessionTypes,
        currency: coachProfiles.currency,
        slug: coachProfiles.slug,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(eq(coachProfiles.isPublished, true))
      .limit(3);

    return coaches;
  } catch {
    return [];
  }
}

function formatPrice(cents: number, currency: string | null) {
  const currencyData = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const symbol = currencyData?.symbol || '$';
  return `${symbol}${(cents / 100).toFixed(0)}`;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getLowestPrice(sessionTypes: SessionType[] | null) {
  if (!sessionTypes || sessionTypes.length === 0) return null;
  return sessionTypes.reduce((min, s) => (s.price < min.price ? s : min));
}

const valueProps = [
  {
    icon: BadgeCheck,
    title: 'Real Credentials, Verified',
    description:
      "Every coach on Co-duck is credential-checked. You'll know exactly what they studied, where, and when.",
  },
  {
    icon: Heart,
    title: 'Trauma-Informed & Inclusive',
    description:
      'Coaches trained in nervous-system-aware, anti-diet, body-neutral, LGBTQ+-affirming care.',
  },
  {
    icon: Lock,
    title: 'Your Story, Your Control',
    description:
      'Session notes you own. Intake you control. Data you can export or delete anytime.',
  },
];

const specialties = [
  { label: 'Hormones & Perimenopause', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800' },
  { label: 'Trauma-Informed', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  { label: 'ADHD Coaching', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-800' },
  { label: 'Grief Support', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
  { label: 'Menopause Circles', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800' },
  { label: 'Somatic Practices', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800' },
  {
    label: 'Gut Health & Functional Medicine',
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
  },
  {
    label: 'Nutrition & Body Neutrality',
    bg: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
  },
];

const credentials = ['NBC-HWC ✓', 'IFM ✓', 'IIN ✓', 'ICF ✓', 'Trauma-Informed Verified'];

export default async function HomePage() {
  const featuredCoaches = await getFeaturedCoaches();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-dark to-burgundy">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Find a Coach Who Gets <span className="text-gold">the Whole You.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
              Certified practitioners in hormones, trauma, ADHD, grief, and menopause — matched to
              your body, mind, and life stage.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-gold px-8 text-base font-semibold text-burgundy-dark hover:bg-gold-dark"
                asChild
              >
                <Link href="/coaches">
                  Find My Coach
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 border border-white/30 px-8 text-base text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/sign-up?role=coach">I&apos;m a Coach →</Link>
              </Button>
            </div>

            {/* Trust row */}
            <div className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {credentials.map((cred) => (
                <span key={cred} className="text-sm font-medium text-white/70">
                  {cred}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-burgundy-light/20 blur-3xl" />
      </section>

      {/* Value Proposition Section */}
      <section className="border-y border-burgundy/10 bg-cream py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Why Co-duck?
            </h2>
            <p className="mt-4 text-muted-foreground">
              A platform built around you — not corporate checkboxes.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {valueProps.map((prop) => (
              <Card
                key={prop.title}
                className="border border-burgundy/10 bg-white shadow-lg transition-all duration-200 hover:border-burgundy/30 hover:shadow-xl"
              >
                <CardContent className="p-8">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-burgundy/10">
                    <prop.icon className="h-7 w-7 text-burgundy" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{prop.title}</h3>
                  <p className="text-muted-foreground">{prop.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by Specialty Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Browse by What You&apos;re Going Through
            </h2>
            <p className="mt-4 text-muted-foreground">
              You don&apos;t have to fit a category — but these might feel familiar.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {specialties.map((specialty) => (
              <Link
                key={specialty.label}
                href={`/coaches?specialties=${encodeURIComponent(specialty.label)}`}
                className="group"
              >
                <div
                  className={`rounded-xl border px-5 py-4 transition-all duration-200 hover:shadow-md ${specialty.bg}`}
                >
                  <p className={`font-medium ${specialty.text}`}>{specialty.label}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground group-hover:text-foreground">
                    Find coaches <ArrowRight className="h-3 w-3" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Coaches Section */}
      <section className="border-y border-burgundy/10 bg-cream py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Meet Some of Our Coaches
            </h2>
            <p className="mt-4 text-muted-foreground">
              Real practitioners, verified credentials, whole-person care.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCoaches.length > 0
              ? featuredCoaches.map((coach) => {
                  const lowestSession = getLowestPrice(coach.sessionTypes as SessionType[] | null);
                  const displaySpecialties =
                    (coach.specialties as string[] | null)?.slice(0, 2) || [];

                  return (
                    <Link key={coach.slug} href={`/coaches/${coach.slug}`}>
                      <Card className="group h-full cursor-pointer transition-all hover:border-burgundy/30 hover:shadow-lg">
                        <CardContent className="p-8">
                          <div className="flex flex-col items-center text-center">
                            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                              <AvatarImage
                                src={coach.avatarUrl || undefined}
                                alt={coach.name || ''}
                              />
                              <AvatarFallback className="text-xl">
                                {coach.name ? (
                                  getInitials(coach.name)
                                ) : (
                                  <User className="h-10 w-10" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <h3 className="mt-4 text-lg font-semibold transition-colors group-hover:text-primary">
                              {coach.name}
                            </h3>
                            {coach.headline && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {coach.headline}
                              </p>
                            )}
                            {displaySpecialties.length > 0 && (
                              <div className="mt-4 flex flex-wrap justify-center gap-1">
                                {displaySpecialties.map((specialty, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {specialty}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {lowestSession && (
                              <div className="mt-4 w-full border-t pt-4">
                                <p className="text-sm text-muted-foreground">Starting from</p>
                                <p className="text-xl font-bold text-primary">
                                  {formatPrice(lowestSession.price, coach.currency)}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              : Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="border-dashed">
                    <CardContent className="p-8">
                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                          <User className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <div className="mt-4 h-5 w-32 rounded bg-muted" />
                        <div className="mt-2 h-4 w-48 rounded bg-muted" />
                        <div className="mt-4 flex gap-1">
                          <div className="h-5 w-16 rounded bg-muted" />
                          <div className="h-5 w-16 rounded bg-muted" />
                        </div>
                        <p className="mt-6 text-sm text-muted-foreground">
                          More coaches coming soon!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
          <div className="mt-12 text-center">
            <Button size="lg" variant="outline" className="h-11" asChild>
              <Link href="/coaches">
                View All Coaches
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gradient-to-br from-burgundy-dark to-burgundy py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Ready to Find the Right Support?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            You deserve a coach who actually understands what you&apos;re going through. Start here.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 bg-gold px-8 text-base font-semibold text-burgundy-dark hover:bg-gold-dark"
              asChild
            >
              <Link href="/coaches">
                Find My Coach
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-12 border border-white/30 px-8 text-base text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="/sign-up?role=coach">Join as a Coach</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
