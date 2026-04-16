import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckIcon } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing | Co-duck — Coaching Platform',
  description:
    'Simple, transparent pricing for coaches. Start free for 14 days, then choose the plan that fits your practice.',
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 39, yearly: 390 },
    description: 'Perfect for coaches just getting started.',
    features: [
      'Up to 50 active clients',
      '10% transaction fee',
      'Booking & payments',
      'Client messaging',
      'Session notes',
      'Email support',
      'Co-duck branding',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 79, yearly: 790 },
    description: 'For coaches building a serious practice.',
    features: [
      'Unlimited clients',
      '5% transaction fee',
      'AI Session Notes (100/mo)',
      'Custom intake forms',
      'Multi-session packages',
      'Priority support',
      'Remove Co-duck branding',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: { monthly: 149, yearly: 1490 },
    description: 'For established coaches scaling their business.',
    features: [
      'Everything in Pro',
      '3% transaction fee',
      'Unlimited AI Session Notes',
      'Multi-coach team (up to 3)',
      'White-label booking widget',
      'API access',
      'Dedicated success manager',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
];

const FAQ = [
  {
    q: 'Is there a free trial?',
    a: 'Yes — every plan includes a 14-day free trial. No credit card required to start.',
  },
  {
    q: 'What does the transaction fee apply to?',
    a: 'The fee applies to each coaching session payment processed through Co-duck. Packages and memberships are also subject to the fee.',
  },
  {
    q: 'Can I change my plan later?',
    a: 'Absolutely. Upgrade or downgrade any time. Changes take effect at the next billing period.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'If you cancel within 7 days of your first payment we will issue a full refund. After that, plans are non-refundable but you keep access until the end of the billing period.',
  },
  {
    q: "What's included in the transaction fee?",
    a: 'The transaction fee covers payment processing, fraud protection, payouts to your connected Stripe account, and platform infrastructure.',
  },
];

export default function PricingPage() {
  return (
    <main className="bg-background">
      {/* Hero */}
      <section className="py-16 text-center">
        <Badge variant="secondary" className="mb-4">
          14-day free trial — no credit card required
        </Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Start free. Scale as you grow. No hidden fees, no surprises.
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.highlight ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center">
                  <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
                </div>
              )}

              <CardHeader className="pb-4 pt-8">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-2">
                  <span className="text-4xl font-bold">${plan.price.monthly}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ${plan.price.yearly}/yr (save 2 months)
                </p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button asChild className="w-full" variant={plan.highlight ? 'default' : 'outline'}>
                  <Link href={`/sign-up?plan=${plan.id}`}>{plan.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparison table — fee comparison callout */}
      <section className="bg-muted/30 py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-3 text-2xl font-bold">Transaction fee comparison</h2>
          <p className="mb-8 text-muted-foreground">The more you grow, the more you keep.</p>
          <div className="overflow-hidden rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 pl-4 text-left font-semibold">Plan</th>
                  <th className="py-3 text-center font-semibold">Fee rate</th>
                  <th className="py-3 pr-4 text-right font-semibold">You keep on $1,000</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 pl-4">Starter</td>
                  <td className="py-3 text-center">10%</td>
                  <td className="py-3 pr-4 text-right font-medium">$900</td>
                </tr>
                <tr className="bg-primary/5 font-medium">
                  <td className="py-3 pl-4">Pro</td>
                  <td className="py-3 text-center text-primary">5%</td>
                  <td className="py-3 pr-4 text-right">$950</td>
                </tr>
                <tr>
                  <td className="py-3 pl-4">Scale</td>
                  <td className="py-3 text-center">3%</td>
                  <td className="py-3 pr-4 text-right font-medium">$970</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold">Frequently asked questions</h2>
        <div className="space-y-6">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="mb-1 font-semibold">{q}</h3>
              <p className="text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">Ready to grow your coaching practice?</h2>
        <p className="mb-8 text-muted-foreground">
          Join coaches who use Co-duck to manage clients, bookings, and payments — all in one place.
        </p>
        <Button asChild size="lg">
          <Link href="/sign-up">Start your free 14-day trial</Link>
        </Button>
      </section>
    </main>
  );
}
