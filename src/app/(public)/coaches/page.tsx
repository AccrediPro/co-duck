import { Suspense } from 'react';
import { Metadata } from 'next';
import { eq, and, or, ilike, sql, desc, asc } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { COACH_CATEGORIES } from '@/lib/validators/coach-onboarding';
import {
  CoachesGrid,
  CoachGridSkeleton,
  CoachSearchFilters,
  type CoachListItem,
  type SortOption,
} from '@/components/coaches';

// This page queries the DB at request time; skip static prerender (CI has no DB).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Find a Coach | AccrediPro CoachHub',
  description:
    'Browse certified coaches in functional medicine, hormones, trauma-informed care, ADHD, grief, and more. Find your perfect match.',
};

const COACHES_PER_PAGE = 12;

interface SearchParams {
  page?: string;
  q?: string;
  /** Category slug (e.g. 'health-wellness') */
  category?: string;
  /** Sub-niche slug (e.g. 'perimenopause-hormones') */
  sub?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: SortOption;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

interface FilterOptions {
  search?: string;
  categoryLabel?: string;
  subNicheLabel?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
}

async function getCoaches(
  page: number,
  filters: FilterOptions
): Promise<{ coaches: CoachListItem[]; totalCount: number }> {
  const offset = (page - 1) * COACHES_PER_PAGE;

  const conditions = [eq(coachProfiles.isPublished, true)];

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

  // Determine sort order
  let orderBy;
  switch (filters.sort) {
    case 'price_low':
      orderBy = asc(
        sql`COALESCE((SELECT MIN((elem->>'price')::integer) FROM jsonb_array_elements(${coachProfiles.sessionTypes}) elem), 999999999)`
      );
      break;
    case 'price_high':
      orderBy = desc(
        sql`COALESCE((SELECT MIN((elem->>'price')::integer) FROM jsonb_array_elements(${coachProfiles.sessionTypes}) elem), 0)`
      );
      break;
    case 'newest':
    default:
      orderBy = desc(coachProfiles.createdAt);
      break;
  }

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
    .limit(COACHES_PER_PAGE * 10) // Over-fetch for client-side specialty filtering
    .offset(0); // We'll slice after filter

  let coaches = await query;

  // Filter by category + sub-niche (application layer — JSONB shape is dynamic).
  // The DB column holds either the legacy `string[]` or the new `{category, subNiches}[]`
  // shape during the 2-level taxonomy transition. Legacy flat entries are matched by
  // their label against the category label (no sub-niche info available).
  if (filters.categoryLabel) {
    coaches = coaches.filter((coach) => {
      if (!coach.specialties || coach.specialties.length === 0) return false;
      return coach.specialties.some((entry) => {
        // Legacy flat string shape: match the label against categoryLabel.
        if (typeof entry === 'string') {
          return !filters.subNicheLabel && entry === filters.categoryLabel;
        }
        if (entry.category !== filters.categoryLabel) return false;
        if (filters.subNicheLabel) {
          return entry.subNiches.includes(filters.subNicheLabel);
        }
        return true;
      });
    });
  }

  // Filter by price range
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    coaches = coaches.filter((coach) => {
      if (!coach.sessionTypes || coach.sessionTypes.length === 0) return false;
      const minSessionPrice = Math.min(...coach.sessionTypes.map((s) => s.price));
      const priceInDollars = minSessionPrice / 100;
      if (filters.minPrice !== undefined && priceInDollars < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && priceInDollars > filters.maxPrice) return false;
      return true;
    });
  }

  const totalCount = coaches.length;
  const paginated = coaches.slice(offset, offset + COACHES_PER_PAGE);

  // Normalize each coach's specialties to the 2-level `{category, subNiches}[]`
  // shape expected by CoachListItem. The DB column holds either shape during
  // the taxonomy transition; legacy flat `string[]` entries are wrapped as
  // categories with no sub-niches.
  const coachesNormalized: CoachListItem[] = paginated.map((c) => ({
    ...c,
    specialties: Array.isArray(c.specialties)
      ? c.specialties.map((entry) =>
          typeof entry === 'string'
            ? { category: entry, subNiches: [] as string[] }
            : { category: entry.category, subNiches: entry.subNiches ?? [] }
        )
      : null,
  }));

  return { coaches: coachesNormalized, totalCount };
}

async function CoachesContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));

  // Resolve slugs → labels for filtering
  const categorySlug = params.category || '';
  const subSlug = params.sub || '';

  let categoryLabel: string | undefined;
  let subNicheLabel: string | undefined;

  if (categorySlug) {
    const cat = COACH_CATEGORIES.find((c) => c.slug === categorySlug);
    categoryLabel = cat?.label;
    if (subSlug && cat) {
      const sub = cat.subNiches.find((s) => s.slug === subSlug);
      subNicheLabel = sub?.label;
    }
  }

  const filters: FilterOptions = {
    search: params.q || undefined,
    categoryLabel,
    subNicheLabel,
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
  const params = await searchParams;
  const categorySlug = params.category || '';
  const subSlug = params.sub || '';

  // Build contextual heading
  let heading = 'Find a Coach';
  let subheading = 'Browse our community of expert coaches ready to help you succeed.';

  if (categorySlug) {
    const cat = COACH_CATEGORIES.find((c) => c.slug === categorySlug);
    if (cat) {
      if (subSlug) {
        const sub = cat.subNiches.find((s) => s.slug === subSlug);
        if (sub) {
          heading = `${sub.label} Coaches`;
          subheading = `Browse certified ${sub.label.toLowerCase()} coaches on AccrediPro CoachHub.`;
        }
      } else {
        heading = `${cat.label} Coaches`;
        subheading = `Browse certified ${cat.label.toLowerCase()} coaches on AccrediPro CoachHub.`;
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-burgundy-dark">{heading}</h1>
        <p className="mt-2 text-muted-foreground">{subheading}</p>
      </div>

      <Suspense fallback={<CoachGridSkeleton count={COACHES_PER_PAGE} />}>
        <CoachesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
