/**
 * @fileoverview Quick AI Coach Onboarding (P0-11)
 *
 * Single-page AI-assisted coach onboarding. The coach pastes a LinkedIn URL,
 * website URL, or "About me" text, and the page calls the AI to draft a
 * complete profile (headline, bio, specialties, credentials, session types,
 * pricing). The coach reviews every field inline and publishes.
 *
 * Falls back to the multi-step wizard at /onboarding/coach if preferred.
 *
 * @module app/(dashboard)/onboarding/coach/quick
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { coachProfiles, users } from '@/db/schema';
import { QuickOnboardingForm } from '@/components/onboarding/quick-onboarding-form';
import { isOpenAIConfigured } from '@/lib/ai/openai';

export const metadata = {
  title: 'Quick Coach Onboarding | Coaching Platform',
  description: 'Set up your coach profile in one page with AI assistance.',
};

export default async function QuickCoachOnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const clerkUser = await currentUser();
  const clerkName = clerkUser?.firstName
    ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ''}`
    : '';

  const [dbUser] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [existingProfile] = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  const initialDisplayName = dbUser?.name || clerkName || '';
  const initialAvatarUrl = dbUser?.avatarUrl || '';

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-burgundy-dark">Quick AI Coach Onboarding</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Paste your LinkedIn URL, your website, or a short &ldquo;About me&rdquo; text, and
          we&rsquo;ll draft your full coach profile. Review every field inline, then publish.
        </p>
      </div>

      <QuickOnboardingForm
        aiAvailable={isOpenAIConfigured()}
        initialDisplayName={initialDisplayName}
        initialAvatarUrl={initialAvatarUrl}
        existingProfile={
          existingProfile
            ? {
                headline: existingProfile.headline ?? '',
                bio: existingProfile.bio ?? '',
                specialties: (existingProfile.specialties ?? []) as Array<{
                  category: string;
                  subNiches: string[];
                }>,
                currency: existingProfile.currency ?? 'USD',
                sessionTypes: (existingProfile.sessionTypes ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                  duration: s.duration,
                  priceCents: s.price,
                })),
                hourlyRateCents: existingProfile.hourlyRate ?? null,
                credentials: (existingProfile.credentials ?? []).map((c) => ({
                  id: c.id,
                  type: c.type,
                  title: c.title,
                  issuer: c.issuer,
                  issuedYear: c.issuedYear,
                  credentialId: c.credentialId ?? null,
                  verificationUrl: c.verificationUrl ?? null,
                })),
                timezone: existingProfile.timezone ?? '',
                isPublished: existingProfile.isPublished ?? false,
              }
            : null
        }
      />
    </div>
  );
}
