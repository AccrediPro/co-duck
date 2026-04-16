import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db, coachProfiles, users } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmbedSnippet } from '@/components/embed-snippet';

export const metadata = {
  title: 'Embed widget | Coaching Platform',
  description: 'Paste a booking widget on your website',
};

export default async function EmbedPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0 || userRows[0].role !== 'coach') {
    return <NotACoach />;
  }

  const profileRows = await db
    .select({
      slug: coachProfiles.slug,
      sessionTypes: coachProfiles.sessionTypes,
      isPublished: coachProfiles.isPublished,
    })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (profileRows.length === 0) {
    return <OnboardingIncomplete />;
  }

  const profile = profileRows[0];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Embed your booking widget</CardTitle>
          <CardDescription>
            Let clients book directly from your own website — Squarespace, WordPress, Linktree,
            Carrd, or anywhere that allows custom HTML.
          </CardDescription>
        </CardHeader>
      </Card>

      {!profile.isPublished && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="py-4 text-sm">
            Your profile isn&apos;t published yet, so visitors who paste the widget will see an
            &quot;unavailable&quot; state. Finish onboarding and publish your profile to enable the
            widget.
          </CardContent>
        </Card>
      )}

      <EmbedSnippet slug={profile.slug} appUrl={appUrl} sessionTypes={profile.sessionTypes ?? []} />
    </div>
  );
}

function NotACoach() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Coach account required</CardTitle>
          <CardDescription>
            The embeddable booking widget is available to coaches only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OnboardingIncomplete() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Finish your coach profile first</CardTitle>
          <CardDescription>
            Once your profile exists you&apos;ll be able to generate an embeddable widget.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/onboarding/coach">Complete onboarding</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
