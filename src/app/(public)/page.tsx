import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center md:py-24">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Find Your Perfect Coach</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Connect with expert coaches for personalized guidance on your personal and professional
          journey.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/coaches">Find a Coach</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-up">Become a Coach</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Why CoachHub?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Expert Coaches</CardTitle>
                <CardDescription>
                  Connect with verified, experienced coaches in various specialties.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All coaches on our platform are vetted professionals ready to help you achieve
                  your goals.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Flexible Scheduling</CardTitle>
                <CardDescription>
                  Book sessions that fit your schedule with easy online booking.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Choose from available time slots and manage your sessions all in one place.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Secure Platform</CardTitle>
                <CardDescription>Your privacy and security are our top priorities.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Secure payments, encrypted communications, and professional standards throughout.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Whether you are looking for guidance or ready to share your expertise, CoachHub is the
          place for you.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/coaches">Browse Coaches</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-up">Join as a Coach</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
