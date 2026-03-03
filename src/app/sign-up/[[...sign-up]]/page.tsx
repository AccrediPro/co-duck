import { SignUp } from '@clerk/nextjs';
import { CheckCircle, Shield, Star, Users } from 'lucide-react';

const benefits = [
  {
    icon: Users,
    title: 'Expert Coaches',
    description: 'Access to certified coaches across various specialties',
  },
  {
    icon: Star,
    title: 'Personalized Matching',
    description: 'Find the perfect coach based on your goals and preferences',
  },
  {
    icon: Shield,
    title: 'Secure Platform',
    description: 'Your data and sessions are protected with encryption',
  },
  {
    icon: CheckCircle,
    title: 'Proven Results',
    description: 'Join thousands achieving their goals with coaching',
  },
];

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      {/* Benefits Section - Hidden on mobile, visible on larger screens */}
      <div className="hidden flex-col justify-center bg-gradient-to-br from-[hsl(var(--brand-warm))] to-[hsl(var(--brand-accent-dark))] p-12 text-white lg:flex lg:w-1/2">
        <div className="mx-auto max-w-md">
          <h1 className="mb-6 text-4xl font-bold">Start Your Journey</h1>
          <p className="mb-10 text-lg text-[hsl(var(--brand-accent-light))]">
            Create your account and discover coaches who can help you reach your full potential.
          </p>

          <div className="space-y-6">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-accent))]/30">
                  <benefit.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{benefit.title}</h3>
                  <p className="text-sm text-[hsl(var(--brand-accent-light))]">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-[hsl(var(--brand-accent))]/30 pt-8">
            <p className="text-sm text-[hsl(var(--brand-accent-light))]">
              &quot;The sign-up process was simple, and I found my perfect coach within a day. Best
              decision I&apos;ve made for my personal growth!&quot;
            </p>
            <p className="mt-2 font-medium">— Michael R., Leadership Coaching Client</p>
          </div>
        </div>
      </div>

      {/* Sign Up Form Section */}
      <div className="flex w-full items-center justify-center bg-cream p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile-only header */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold text-burgundy-dark">Start Your Journey</h1>
            <p className="mt-2 text-muted-foreground">Create an account to find your perfect coach</p>
          </div>

          <SignUp
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-lg rounded-xl',
                headerTitle: 'text-xl font-bold',
                headerSubtitle: 'text-muted-foreground',
                socialButtonsBlockButton: 'border border-burgundy/20 hover:bg-cream',
                formButtonPrimary: 'bg-[hsl(var(--brand-warm))] hover:bg-[hsl(var(--brand-accent-hover))]',
                footerActionLink: 'text-[hsl(var(--brand-warm))] hover:text-[hsl(var(--brand-accent-hover))]',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
