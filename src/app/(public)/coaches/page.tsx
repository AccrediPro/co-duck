import { Suspense } from 'react';
import { Metadata } from 'next';
import { eq, and, or, ilike, sql, desc, asc } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import {
  CoachesGrid,
  CoachGridSkeleton,
  CoachSearchFilters,
  type CoachListItem,
  type SortOption,
} from '@/components/coaches';
import { flattenSpecialties } from '@/lib/validators/coach-onboarding';

export const metadata: Metadata = {
  title: 'Find a Coach | Coaching Platform',
  description:
    'Browse our community of expert coaches. Find the perfect coach for career, life, wellness, leadership, and more.',
};

const COACHES_PER_PAGE = 12;

interface SearchParams {
  page?: string;
  q?: string;
  specialties?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: SortOption;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

interface FilterOptions {
  search?: string;
  specialties?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
}

async function getCoaches(
  page: number,
  filters: FilterOptions
): Promise<{ coaches: CoachListItem[]; totalCount: number }> {
  const offset = (page - 1) * COACHES_PER_PAGE;

  // Build where conditions
  const conditions = [eq(coachProfiles.isPublished, true)];

  // Search filter - search in name, headline, and bio
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.name, searchTerm),
        ilike(coachProfiles.headline, searchTerm),
        ilike(coachProfiles.bio, searchTerm)
      )!
    );
  }

  // Get total count with filters (excluding price filter for count since it requires subquery)
  const baseQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(and(...conditions));

  const countResult = await baseQuery;
  let totalCount = Number(countResult[0]?.count || 0);

  // Determine sort order
  let orderBy;
  switch (filters.sort) {
    case 'price_low':
      // Sort by minimum session price (ascending)
      orderBy = asc(
        sql`COALESCE((SELECT MIN((elem->>'price')::integer) FROM jsonb_array_elements(${coachProfiles.sessionTypes}) elem), 999999999)`
      );
      break;
    case 'price_high':
      // Sort by minimum session price (descending)
      orderBy = desc(
        sql`COALESCE((SELECT MIN((elem->>'price')::integer) FROM jsonb_array_elements(${coachProfiles.sessionTypes}) elem), 0)`
      );
      break;
    case 'newest':
    default:
      orderBy = desc(coachProfiles.createdAt);
      break;
  }

  // Get coaches for current page with all filters
  const query = db
    .select({
      userId: coachProfiles.userId,
      slug: coachProfiles.slug,
      headline: coachProfiles.headline,
      specialties: coachProfiles.specialties,
      currency: coachProfiles.currency,
      sessionTypes: coachProfiles.sessionTypes,
      averageRating: coachProfiles.averageRating,
      reviewCount: coachProfiles.reviewCount,
      verificationStatus: coachProfiles.verificationStatus,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(coachProfiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(COACHES_PER_PAGE)
    .offset(offset);

  let coaches = await query;

  // Filter by specialties in application layer (JSONB array contains is complex in Drizzle).
  // The DB column holds either the legacy `string[]` or the new `{category, subNiches}[]`
  // shape — `flattenSpecialties` normalizes both to a flat label array for filtering.
  if (filters.specialties && filters.specialties.length > 0) {
    coaches = coaches.filter((coach) => {
      const flat = flattenSpecialties(coach.specialties);
      if (flat.length === 0) return false;
      return filters.specialties!.some((spec) => flat.includes(spec));
    });
  }

  // Filter by price range in application layer (JSONB queries are complex)
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    coaches = coaches.filter((coach) => {
      if (!coach.sessionTypes || coach.sessionTypes.length === 0) return false;

      // Get minimum price from session types (in cents)
      const minSessionPrice = Math.min(...coach.sessionTypes.map((s) => s.price));
      const priceInDollars = minSessionPrice / 100;

      if (filters.minPrice !== undefined && priceInDollars < filters.minPrice) {
        return false;
      }
      if (filters.maxPrice !== undefined && priceInDollars > filters.maxPrice) {
        return false;
      }
      return true;
    });
  }

  // Adjust count for client-side filters (specialty and price)
  if (
    filters.specialties?.length ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined
  ) {
    // Re-fetch all and filter to get accurate count
    const allCoaches = await db
      .select({
        userId: coachProfiles.userId,
        specialties: coachProfiles.specialties,
        sessionTypes: coachProfiles.sessionTypes,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(and(...conditions));

    let filteredCount = allCoaches.length;

    if (filters.specialties && filters.specialties.length > 0) {
      filteredCount = allCoaches.filter((coach) => {
        const flat = flattenSpecialties(coach.specialties);
        if (flat.length === 0) return false;
        return filters.specialties!.some((spec) => flat.includes(spec));
      }).length;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const tempFiltered = allCoaches.filter((coach) => {
        if (filters.specialties && filters.specialties.length > 0) {
          const flat = flattenSpecialties(coach.specialties);
          if (flat.length === 0) return false;
          if (!filters.specialties.some((spec) => flat.includes(spec))) {
            return false;
          }
        }
        if (!coach.sessionTypes || coach.sessionTypes.length === 0) return false;
        const minSessionPrice = Math.min(...coach.sessionTypes.map((s) => s.price));
        const priceInDollars = minSessionPrice / 100;
        if (filters.minPrice !== undefined && priceInDollars < filters.minPrice) return false;
        if (filters.maxPrice !== undefined && priceInDollars > filters.maxPrice) return false;
        return true;
      });
      filteredCount = tempFiltered.length;
    }

    totalCount = filteredCount;
  }

  // Normalize each coach's specialties to flat `string[]` for CoachListItem.
  const coachesNormalized: CoachListItem[] = coaches.map((c) => ({
    ...c,
    specialties: flattenSpecialties(c.specialties),
  }));

  return { coaches: coachesNormalized, totalCount };
}

async function CoachesContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const filters: FilterOptions = {
    search: params.q || undefined,
    specialties: params.specialties ? params.specialties.split(',') : undefined,
    minPrice: params.minPrice ? parseInt(params.minPrice, 10) : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice, 10) : undefined,
    sort: (params.sort as SortOption) || 'newest',
  };

  const { coaches, totalCount } = await getCoaches(page, filters);

  return (
    <>
      <CoachSearchFilters totalCount={totalCount} />
      <CoachesGrid
        coaches={coaches}
        totalCount={totalCount}
        currentPage={page}
        perPage={COACHES_PER_PAGE}
        showResultsCount={false}
      />
    </>
  );
}

export default async function CoachesPage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-burgundy-dark">Find a Coach</h1>
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
