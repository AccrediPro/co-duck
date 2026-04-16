import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
  title: 'Coaching Specialties | Co-duck',
  description:
    'Find coaches specializing in hormones, menopause, trauma, ADHD, grief, gut health, and whole-person wellness on Co-duck.',
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
    'Navigate big transitions, set meaningful goals, and create a life that fits who you actually are — not who you were supposed to be.',
  'Career Coaching':
    'Move through career pivots, burnout recovery, and finding work that aligns with your values and energy.',
  'Health & Wellness':
    'Build sustainable habits rooted in your biology, not willpower. Coaches trained in functional and integrative approaches.',
  'Executive Coaching':
    'Lead with clarity and integrity. For executives who want to grow without burning out or leaving themselves behind.',
  'Relationship Coaching':
    'Heal communication patterns, deepen connections, and build relationships grounded in safety and trust.',
  'Business Coaching':
    'Grow your practice or business in a way that works with your nervous system and life — not against it.',
  'Leadership Coaching':
    'Develop your leadership style, build psychological safety on your team, and lead from values.',
  'Mindset & Motivation':
    'Work through limiting beliefs, perfectionism, and nervous system patterns that keep you stuck.',
  'Financial Coaching':
    'Build a healthy relationship with money — one rooted in your values, not shame or scarcity.',
  'Parenting Coaching':
    'Navigate the challenges of parenting with more confidence, connection, and compassion for yourself.',
  'Spiritual Coaching':
    'Explore meaning, purpose, and inner knowing. For those seeking guidance that goes beyond the surface.',
  'Performance Coaching':
    'Optimize your performance in a sustainable way — honoring recovery, regulation, and what your body needs.',
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
              Find a Coach for <span className="text-gold">What You&apos;re Actually Facing</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
              Browse by specialty and connect with coaches trained in the exact support you need —
              hormones, trauma, menopause, ADHD, grief, and more.
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
            Not sure which specialty fits what you&apos;re going through?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Browse all coaches and filter by credential type, approach, or availability. You
            don&apos;t have to have it figured out before you start.
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
