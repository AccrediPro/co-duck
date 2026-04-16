import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

// This page queries the DB at request time; skip static prerender (CI has no DB).
export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users } from 'lucide-react';
import {
  Briefcase,
  Heart,
  Brain,
  Target,
  Handshake,
  Building2,
  Crown,
  Sparkles,
  Wallet,
  Baby,
  Flower2,
  Zap,
} from 'lucide-react';
import { db, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import { COACH_SPECIALTIES } from '@/lib/validators/coach-onboarding';

export const metadata: Metadata = {
  title: 'Coaching Specialties | AccrediPro CoachHub',
  description:
    'Explore our coaching specialties. Find expert coaches in life coaching, career coaching, wellness, leadership, and more.',
};

// Map specialties to their icons
const specialtyIcons: Record<string, React.ElementType> = {
  'Life Coaching': Heart,
  'Career Coaching': Briefcase,
  'Health & Wellness': Flower2,
  'Executive Coaching': Crown,
  'Relationship Coaching': Handshake,
  'Business Coaching': Building2,
  'Leadership Coaching': Target,
  'Mindset & Motivation': Brain,
  'Financial Coaching': Wallet,
  'Parenting Coaching': Baby,
  'Spiritual Coaching': Sparkles,
  'Performance Coaching': Zap,
};

// Map specialties to their descriptions
const specialtyDescriptions: Record<string, string> = {
  'Life Coaching':
    'Find balance, set meaningful goals, and create the life you envision with personalized guidance.',
  'Career Coaching':
    'Navigate career transitions, advance professionally, and find fulfillment in your work.',
  'Health & Wellness':
    'Build sustainable habits, improve your wellbeing, and achieve your health goals.',
  'Executive Coaching':
    'Enhance your leadership presence, decision-making, and strategic thinking at the executive level.',
  'Relationship Coaching':
    'Improve communication, deepen connections, and build healthier relationships.',
  'Business Coaching': 'Scale your business, overcome challenges, and achieve sustainable growth.',
  'Leadership Coaching':
    'Develop your leadership skills, inspire teams, and drive organizational success.',
  'Mindset & Motivation':
    'Transform limiting beliefs, build resilience, and unlock your full potential.',
  'Financial Coaching': 'Master money management, build wealth, and achieve financial freedom.',
  'Parenting Coaching':
    'Navigate parenting challenges with confidence and build stronger family bonds.',
  'Spiritual Coaching': 'Explore your inner journey, find purpose, and cultivate spiritual growth.',
  'Performance Coaching':
    'Optimize your performance, break through plateaus, and achieve peak results.',
};

async function getSpecialtyCoachCounts(): Promise<Record<string, number>> {
  // Get all published coaches with their specialties
  const coaches = await db
    .select({
      specialties: coachProfiles.specialties,
    })
    .from(coachProfiles)
    .where(eq(coachProfiles.isPublished, true));

  // Count coaches per specialty
  const counts: Record<string, number> = {};

  // Initialize all specialties with 0
  COACH_SPECIALTIES.forEach((specialty) => {
    counts[specialty] = 0;
  });

  // Count coaches for each specialty
  coaches.forEach((coach) => {
    if (coach.specialties && Array.isArray(coach.specialties)) {
      coach.specialties.forEach((specialty) => {
        if (typeof specialty === 'string' && counts[specialty] !== undefined) {
          counts[specialty]++;
        }
      });
    }
  });

  return counts;
}

export default async function SpecialtiesPage() {
  const coachCounts = await getSpecialtyCoachCounts();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-dark to-burgundy">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Explore Coaching <span className="text-gold">Specialties</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
              Find the perfect coach for your unique goals. Browse our specialties and connect with
              experts who can guide your journey to success.
            </p>
          </div>
        </div>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-burgundy-light/20 blur-3xl" />
      </section>

      {/* Specialties Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {COACH_SPECIALTIES.map((specialty) => {
              const Icon = specialtyIcons[specialty] || Target;
              const description =
                specialtyDescriptions[specialty] ||
                'Connect with expert coaches in this specialty.';
              const count = coachCounts[specialty] || 0;

              return (
                <Link
                  key={specialty}
                  href={`/coaches?specialties=${encodeURIComponent(specialty)}`}
                  className="group"
                >
                  <Card className="h-full transition-all duration-200 hover:border-burgundy/30 hover:shadow-lg">
                    <CardContent className="flex flex-col p-6">
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy/10 transition-colors group-hover:bg-burgundy/20">
                        <Icon className="h-6 w-6 text-burgundy" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold transition-colors group-hover:text-burgundy">
                        {specialty}
                      </h3>
                      <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
                        {description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>
                            {count} coach{count !== 1 ? 'es' : ''}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-burgundy" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-burgundy-dark to-burgundy py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Not sure which specialty is right for you?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Browse all our coaches and find someone who resonates with your goals and aspirations.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 bg-gold px-8 text-burgundy-dark hover:bg-gold-dark"
              asChild
            >
              <Link href="/coaches">
                Browse All Coaches
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-white/30 px-8 text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="/contact">Get Recommendations</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
