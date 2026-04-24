import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Sparkles, ArrowRight, CheckCircle, Shield, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us | AccrediPro CoachHub',
  description:
    'AccrediPro CoachHub connects people with credential-verified, trauma-informed coaches in hormones, menopause, ADHD, grief, and whole-person health.',
};

const stats = [
  { value: '1,000+', label: 'Clients Supported' },
  { value: '100+', label: 'Verified Coaches' },
  { value: '10,000+', label: 'Sessions Completed' },
  { value: '4.9/5', label: 'Average Rating' },
];

const values = [
  {
    icon: Shield,
    title: 'Credential-First',
    description:
      "We verify every coach's certifications before they appear on the platform — NBC-HWC, IFM, IIN, ICF, and trauma-informed training included.",
  },
  {
    icon: Heart,
    title: 'Whole-Person Care',
    description:
      'Your body, hormones, nervous system, and life stage all matter. We match you with coaches trained to see the full picture.',
  },
  {
    icon: Users,
    title: 'Inclusive by Design',
    description:
      "Anti-diet. Body-neutral. LGBTQ+-affirming. Our coaches practice care that doesn't leave parts of you at the door.",
  },
  {
    icon: Sparkles,
    title: 'Your Data, Your Control',
    description:
      'Session notes you own. Intake forms you control. Export or delete your data anytime — no questions asked.',
  },
];

const milestones = [
  {
    year: '2023',
    title: 'Founded',
    description:
      'AccrediPro CoachHub launched with one mission: make it easier to find a coach who actually gets your health journey.',
  },
  {
    year: '2024',
    title: 'Growing Community',
    description:
      'Expanded to 100+ verified coaches specializing in hormones, trauma, menopause, ADHD, and functional medicine.',
  },
  {
    year: '2025',
    title: 'Platform Evolution',
    description:
      'Introduced specialty-based matching, secure messaging, and enhanced privacy tools for client data ownership.',
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-dark to-burgundy">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Built for the Whole You — <span className="text-gold">Not Just the Symptoms</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
              At AccrediPro CoachHub, we connect you with credential-verified coaches who understand
              hormones, trauma, ADHD, grief, menopause, and the ways your body and life intersect.
            </p>
          </div>
        </div>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-burgundy-light/20 blur-3xl" />
      </section>

      {/* Stats Section */}
      <section className="border-y border-burgundy/10 bg-cream py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold text-burgundy">{stat.value}</div>
                <div className="mt-2 text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Our Mission
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Too many people spend years in doctors&apos; offices being told their labs are
              &quot;normal&quot; while they feel anything but. We believe you deserve support from
              someone who understands how hormones, nervous system dysregulation, life transitions,
              and whole-body health connect. AccrediPro CoachHub exists to make that kind of coach
              findable, affordable, and accountable — with credentials you can actually verify.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="border-y border-burgundy/10 bg-cream py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              What We Stand For
            </h2>
            <p className="mt-4 text-muted-foreground">
              The principles that guide every decision on AccrediPro CoachHub.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <Card key={value.title} className="border-0 bg-white shadow-lg">
                <CardContent className="p-8">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-burgundy/10">
                    <value.icon className="h-7 w-7 text-burgundy" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Our Journey
            </h2>
            <p className="mt-4 text-muted-foreground">
              Key milestones in the AccrediPro CoachHub story.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-3xl">
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={milestone.year} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-burgundy font-bold text-white">
                      {index + 1}
                    </div>
                    {index < milestones.length - 1 && (
                      <div className="mt-2 h-full w-0.5 bg-burgundy/20" />
                    )}
                  </div>
                  <div className="pb-8">
                    <div className="text-sm font-medium text-burgundy">{milestone.year}</div>
                    <h3 className="mt-1 text-xl font-semibold">{milestone.title}</h3>
                    <p className="mt-2 text-muted-foreground">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="border-y border-burgundy/10 bg-cream py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
                What Makes AccrediPro CoachHub Different
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We&apos;re not a generic marketplace. Every feature was built with health and
                wellness clients in mind.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Credential-verified coaches — no self-reporting',
                  'Specialty matching: hormones, trauma, ADHD, menopause, and more',
                  'Trauma-informed, anti-diet, body-neutral coaches available',
                  'Private 1:1 messaging with end-to-end encryption',
                  'Session notes and intake data you own and can export',
                  'LGBTQ+-affirming care listed on every coach profile',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-sage" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-burgundy-dark to-burgundy p-8 text-white md:p-12">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold md:text-3xl">Ready to find your coach?</h3>
                <p className="mt-4 text-white/90">
                  Browse credential-verified practitioners and find someone who understands your
                  whole health story.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-11 bg-gold font-semibold text-burgundy-dark hover:bg-gold-dark"
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
                    className="h-11 border border-white/30 text-white hover:bg-white/10 hover:text-white"
                    asChild
                  >
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                </div>
              </div>
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
            Start Your Journey
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Find a coach who gets your whole story — hormones, history, and all.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
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
