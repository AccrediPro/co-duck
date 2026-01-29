import { Suspense } from 'react';
import { Metadata } from 'next';
import { eq, sql } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { CoachesGrid, CoachGridSkeleton, type CoachListItem } from '@/components/coaches';

export const metadata: Metadata = {
  title: 'Find a Coach | Coaching Platform',
  description:
    'Browse our community of expert coaches. Find the perfect coach for career, life, wellness, leadership, and more.',
};

const COACHES_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

async function getCoaches(page: number): Promise<{ coaches: CoachListItem[]; totalCount: number }> {
  const offset = (page - 1) * COACHES_PER_PAGE;

  // Get total count of published coaches
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(coachProfiles)
    .where(eq(coachProfiles.isPublished, true));

  const totalCount = Number(countResult[0]?.count || 0);

  // Get coaches for current page
  const coaches = await db
    .select({
      userId: coachProfiles.userId,
      slug: coachProfiles.slug,
      headline: coachProfiles.headline,
      specialties: coachProfiles.specialties,
      currency: coachProfiles.currency,
      sessionTypes: coachProfiles.sessionTypes,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(eq(coachProfiles.isPublished, true))
    .orderBy(coachProfiles.createdAt)
    .limit(COACHES_PER_PAGE)
    .offset(offset);

  return { coaches, totalCount };
}

async function CoachesContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const { coaches, totalCount } = await getCoaches(page);

  return (
    <CoachesGrid
      coaches={coaches}
      totalCount={totalCount}
      currentPage={page}
      perPage={COACHES_PER_PAGE}
    />
  );
}

export default async function CoachesPage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Find a Coach</h1>
        <p className="mt-2 text-muted-foreground">
          Browse our community of expert coaches ready to help you succeed.
        </p>
      </div>

      <Suspense fallback={<CoachGridSkeleton count={COACHES_PER_PAGE} />}>
        <CoachesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
