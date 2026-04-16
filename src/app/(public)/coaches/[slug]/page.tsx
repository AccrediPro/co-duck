import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { db, users, coachProfiles } from '@/db';
import { memberships, membershipSubscriptions } from '@/db/schema';
import { CoachProfileDisplay } from '@/components/coaches/coach-profile-display';
import { getCoachAvailabilityForProfile } from './availability-actions';

/**
 * Normalize the coach_profiles.specialties JSONB union to the 2-level shape
 * consumed by <CoachProfileDisplay>. Legacy flat `string[]` entries are
 * promoted to categories with empty sub-niches.
 */
function toTwoLevelSpecialties(
  value: string[] | Array<{ category: string; subNiches: string[] }> | null
): Array<{ category: string; subNiches: string[] }> {
  if (!value || value.length === 0) return [];
  if (typeof value[0] === 'string') {
    return (value as string[]).map((label) => ({ category: label, subNiches: [] }));
  }
  return value as Array<{ category: string; subNiches: string[] }>;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Fetch coach profile data
async function getCoachProfile(slug: string) {
  const result = await db
    .select({
      userId: coachProfiles.userId,
      slug: coachProfiles.slug,
      headline: coachProfiles.headline,
      bio: coachProfiles.bio,
      specialties: coachProfiles.specialties,
      hourlyRate: coachProfiles.hourlyRate,
      currency: coachProfiles.currency,
      timezone: coachProfiles.timezone,
      sessionTypes: coachProfiles.sessionTypes,
      isPublished: coachProfiles.isPublished,
      verificationStatus: coachProfiles.verificationStatus,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(and(eq(coachProfiles.slug, slug), eq(coachProfiles.isPublished, true)))
    .limit(1);

  return result[0] || null;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const coach = await getCoachProfile(slug);

  if (!coach) {
    return {
      title: 'Coach Not Found | Coaching Platform',
    };
  }

  const title = `${coach.name} - ${coach.headline || 'Professional Coach'} | Coaching Platform`;
  const description =
    coach.bio?.slice(0, 160) ||
    `Book a coaching session with ${coach.name}. ${coach.headline || ''}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: coach.avatarUrl ? [{ url: coach.avatarUrl, width: 200, height: 200 }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: coach.avatarUrl ? [coach.avatarUrl] : [],
    },
  };
}

export default async function CoachProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const coach = await getCoachProfile(slug);

  if (!coach) {
    notFound();
  }

  // Get current user ID for messaging (optional - only if logged in)
  const { userId } = await auth();

  // Fetch availability data for display
  const availability = await getCoachAvailabilityForProfile(coach.userId);

  // Fetch this coach's active memberships (for the "Ongoing coaching" block).
  const coachMembershipsRows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.coachId, coach.userId), eq(memberships.isActive, true)))
    .orderBy(desc(memberships.monthlyPriceCents));

  // If the viewer is logged in, check whether they already have a live
  // subscription with this coach so we can swap the "Subscribe" CTA for
  // "Manage subscription".
  let currentUserHasActiveSubscription = false;
  if (userId) {
    const existingSub = await db.query.membershipSubscriptions.findFirst({
      where: and(
        eq(membershipSubscriptions.clientId, userId),
        eq(membershipSubscriptions.coachId, coach.userId)
      ),
    });
    if (existingSub && (existingSub.status === 'active' || existingSub.status === 'past_due')) {
      currentUserHasActiveSubscription = true;
    }
  }

  const coachMemberships = coachMembershipsRows.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    monthlyPriceCents: m.monthlyPriceCents,
    currency: m.currency,
    sessionsPerPeriod: m.sessionsPerPeriod,
    includesMessaging: m.includesMessaging,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <CoachProfileDisplay
        name={coach.name || 'Coach'}
        avatarUrl={coach.avatarUrl}
        headline={coach.headline}
        bio={coach.bio}
        specialties={toTwoLevelSpecialties(coach.specialties)}
        timezone={coach.timezone}
        hourlyRate={coach.hourlyRate}
        currency={coach.currency}
        sessionTypes={coach.sessionTypes}
        slug={coach.slug}
        availability={availability}
        coachId={coach.userId}
        currentUserId={userId}
        isVerified={coach.verificationStatus === 'verified'}
        memberships={coachMemberships}
        currentUserHasActiveSubscription={currentUserHasActiveSubscription}
      />

      {/* Not Medical Advice disclaimer */}
      <div className="mx-auto mt-8 max-w-4xl rounded-lg border border-muted bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Not medical advice:</span> Coaches on Co-duck
        are not licensed medical providers. Nothing shared in a session constitutes medical advice,
        diagnosis, or treatment. If you have an urgent medical concern, contact your physician or
        call 911.
      </div>
    </div>
  );
}
