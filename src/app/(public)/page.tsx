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
import { Users, Calendar, Shield, Star, ArrowRight, User } from 'lucide-react';

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
    icon: Users,
    title: 'Expert Coaches',
    description:
      'Connect with verified, experienced coaches across career, leadership, wellness, and personal development.',
  },
  {
    icon: Calendar,
    title: 'Flexible Scheduling',
    description:
      'Book sessions that fit your life. Choose from various time slots and manage everything in one place.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description:
      'Your privacy matters. Secure payments, encrypted sessions, and professional confidentiality standards.',
  },
];

const howItWorks = [
  {
    step: 1,
    title: 'Browse Coaches',
    description:
      'Explore profiles, read reviews, and find a coach that matches your goals and style.',
  },
  {
    step: 2,
    title: 'Book a Session',
    description: 'Choose a time that works for you and book your first session in minutes.',
  },
  {
    step: 3,
    title: 'Achieve Your Goals',
    description: 'Work with your coach to unlock your potential and make lasting progress.',
  },
];

export default async function HomePage() {
  const featuredCoaches = await getFeaturedCoaches();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-dark to-burgundy">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-6 border-gold/30 bg-gold/20 px-4 py-1.5 text-sm text-white hover:bg-gold/30">
              <Star className="mr-1.5 h-3.5 w-3.5 text-gold" />
              Trusted by 1,000+ clients worldwide
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Find Your <span className="text-gold">Perfect Coach</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
              Connect with expert coaches for personalized guidance on your personal and
              professional journey. Transform your life with one-on-one coaching that works.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-gold px-8 text-base text-burgundy-dark hover:bg-gold-dark"
                asChild
              >
                <Link href="/coaches">
                  Find a Coach
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                className="h-12 bg-gold px-8 text-base text-white hover:bg-gold-dark"
                asChild
              >
                <Link href="/sign-up">Get Started</Link>
              </Button>
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
              Why Choose AccrediPro CoachHub?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Everything you need to find the right coach and achieve your goals.
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

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-muted-foreground">
              Get started in three simple steps and begin your transformation journey.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.step} className="relative text-center">
                {/* Step number */}
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-burgundy bg-white text-2xl font-bold text-burgundy">
                  {item.step}
                </div>
                {/* Connector line (hidden on mobile, shown between items on desktop) */}
                {item.step < 3 && (
                  <div className="absolute left-[calc(50%+40px)] top-8 hidden h-0.5 w-[calc(100%-80px)] bg-gradient-to-r from-burgundy to-burgundy/30 md:block" />
                )}
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="mx-auto max-w-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Coaches Section */}
      <section className="border-y border-burgundy/10 bg-cream py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Featured Coaches
            </h2>
            <p className="mt-4 text-muted-foreground">
              Meet some of the amazing coaches ready to help you succeed.
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
              : /* Placeholder cards when no coaches are available */
                Array.from({ length: 3 }).map((_, index) => (
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
            Ready to Transform Your Life?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Find the right coach and start your journey toward personal and professional growth.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              className="h-12 bg-gold px-8 text-base text-burgundy-dark hover:bg-gold-dark"
              asChild
            >
              <Link href="/coaches">
                Browse Coaches
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
