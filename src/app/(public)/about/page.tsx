import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Target, Heart, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us | AccrediPro CoachHub',
  description:
    'Learn about AccrediPro CoachHub - our mission to connect people with expert coaches for personal and professional growth.',
};

const stats = [
  { value: '1,000+', label: 'Active Clients' },
  { value: '100+', label: 'Expert Coaches' },
  { value: '10,000+', label: 'Sessions Completed' },
  { value: '4.9/5', label: 'Average Rating' },
];

const values = [
  {
    icon: Target,
    title: 'Purpose-Driven',
    description:
      'We believe everyone deserves access to quality coaching to help them reach their full potential.',
  },
  {
    icon: Heart,
    title: 'Client-Centered',
    description:
      'Your growth is at the heart of everything we do. We match you with coaches who truly understand your goals.',
  },
  {
    icon: Users,
    title: 'Community-Focused',
    description:
      'We foster a supportive community of coaches and clients committed to growth and positive change.',
  },
  {
    icon: Sparkles,
    title: 'Excellence',
    description:
      'We maintain high standards for our coaches and continuously improve our platform for the best experience.',
  },
];

const milestones = [
  {
    year: '2023',
    title: 'Founded',
    description:
      'AccrediPro CoachHub was launched with a vision to democratize access to professional coaching.',
  },
  {
    year: '2024',
    title: 'Growing Community',
    description: 'Expanded to 100+ verified coaches across multiple specialties worldwide.',
  },
  {
    year: '2025',
    title: 'Platform Evolution',
    description: 'Introduced advanced matching, group sessions, and enhanced scheduling tools.',
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
              Empowering Growth Through <span className="text-gold">Expert Coaching</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
              At AccrediPro CoachHub, we connect individuals with world-class coaches to unlock
              their potential, achieve their goals, and transform their lives.
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
              We believe that everyone has the potential to achieve extraordinary things. Our
              mission is to make professional coaching accessible, affordable, and effective for
              anyone seeking personal or professional growth. By connecting you with the right
              coach, we help you overcome obstacles, develop new skills, and create lasting positive
              change in your life.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="border-y border-burgundy/10 bg-cream py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-burgundy-dark md:text-4xl">
              Our Values
            </h2>
            <p className="mt-4 text-muted-foreground">
              The principles that guide everything we do at AccrediPro CoachHub.
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
                What Makes Us Different
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We are not just another coaching platform. We are committed to creating meaningful
                connections that lead to real results.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Verified and vetted professional coaches',
                  'Personalized matching based on your goals',
                  'Flexible scheduling that fits your life',
                  'Secure and private communication',
                  'Progress tracking and accountability tools',
                  'Money-back satisfaction guarantee',
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
                <h3 className="text-2xl font-bold md:text-3xl">Ready to start your journey?</h3>
                <p className="mt-4 text-white/90">
                  Join thousands of others who have transformed their lives with the help of expert
                  coaching.
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-11 bg-gold font-semibold text-burgundy-dark hover:bg-gold-dark"
                    asChild
                  >
                    <Link href="/coaches">
                      Find a Coach
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
            Find the right coach and take the first step toward achieving your goals.
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
