import { sql, eq, and, inArray, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReviewVisibilityToggle } from '@/components/admin/review-visibility-toggle';
import { db, reviews, users } from '@/db';
import { Star, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import Link from 'next/link';

const REVIEWS_PER_PAGE = 20;

interface SearchParams {
  rating?: string;
  visibility?: string;
  page?: string;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

async function toggleReviewVisibility(reviewId: number, isPublic: boolean) {
  'use server';

  try {
    await db.update(reviews).set({ isPublic }).where(eq(reviews.id, reviewId));
    revalidatePath('/admin/reviews');
  } catch (error) {
    console.error('[Admin] Error toggling review visibility:', error);
    throw error;
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getReviews(options: {
  rating?: number;
  visibility?: string;
  page: number;
  limit: number;
}) {
  const { rating, visibility, page, limit } = options;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];

    if (rating && rating >= 1 && rating <= 5) {
      conditions.push(eq(reviews.rating, rating));
    }

    if (visibility === 'public') {
      conditions.push(eq(reviews.isPublic, true));
    } else if (visibility === 'hidden') {
      conditions.push(eq(reviews.isPublic, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [allReviews, countResult] = await Promise.all([
      db
        .select()
        .from(reviews)
        .where(whereClause)
        .orderBy(desc(reviews.createdAt))
        .offset(offset)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(whereClause),
    ]);

    const userIds = Array.from(new Set(allReviews.flatMap((r) => [r.coachId, r.clientId])));
    const usersData =
      userIds.length > 0
        ? await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    const totalCount = Number(countResult[0]?.count) || 0;

    return {
      reviews: allReviews.map((r) => ({
        ...r,
        coach: usersMap.get(r.coachId) || { name: 'Unknown', email: '' },
        client: usersMap.get(r.clientId) || { name: 'Unknown', email: '' },
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('[Admin] Error fetching reviews:', error);
    return { reviews: [], totalCount: 0, totalPages: 0, currentPage: 1 };
  }
}

async function getReviewStats() {
  try {
    const [totalResult, publicResult, hiddenResult, avgResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(reviews),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.isPublic, true)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(eq(reviews.isPublic, false)),
      db.select({ avg: sql<number>`COALESCE(AVG(${reviews.rating}), 0)` }).from(reviews),
    ]);

    return {
      total: Number(totalResult[0]?.count) || 0,
      public: Number(publicResult[0]?.count) || 0,
      hidden: Number(hiddenResult[0]?.count) || 0,
      averageRating: Number(Number(avgResult[0]?.avg).toFixed(1)) || 0,
    };
  } catch (error) {
    console.error('[Admin] Error fetching review stats:', error);
    return { total: 0, public: 0, hidden: 0, averageRating: 0 };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function SearchFilters({
  currentRating,
  currentVisibility,
}: {
  currentRating: string;
  currentVisibility: string;
}) {
  return (
    <form className="flex flex-col gap-4 sm:flex-row">
      <Select name="rating" defaultValue={currentRating || 'all'}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Filter by rating" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ratings</SelectItem>
          <SelectItem value="5">5 stars</SelectItem>
          <SelectItem value="4">4 stars</SelectItem>
          <SelectItem value="3">3 stars</SelectItem>
          <SelectItem value="2">2 stars</SelectItem>
          <SelectItem value="1">1 star</SelectItem>
        </SelectContent>
      </Select>
      <Select name="visibility" defaultValue={currentVisibility || 'all'}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Filter by visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All reviews</SelectItem>
          <SelectItem value="public">Public only</SelectItem>
          <SelectItem value="hidden">Hidden only</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Filter</Button>
    </form>
  );
}

function ReviewRow({
  review,
  onToggleVisibility,
}: {
  review: {
    id: number;
    rating: number;
    title: string | null;
    content: string | null;
    coachResponse: string | null;
    isPublic: boolean;
    createdAt: Date;
    coach: { name: string | null; email: string };
    client: { name: string | null; email: string };
  };
  onToggleVisibility: (reviewId: number, isPublic: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-3 border-b py-4 last:border-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StarRating rating={review.rating} />
            {review.title && (
              <span className="font-medium">{truncateText(review.title, 60)}</span>
            )}
            <Badge variant={review.isPublic ? 'default' : 'secondary'}>
              {review.isPublic ? 'Public' : 'Hidden'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            By <span className="font-medium">{review.client.name || review.client.email}</span>
            {' for '}
            <span className="font-medium">{review.coach.name || review.coach.email}</span>
          </p>
          {review.content && (
            <p className="text-sm">{truncateText(review.content, 200)}</p>
          )}
          {review.coachResponse && (
            <div className="mt-2 rounded-md bg-muted/50 p-2">
              <p className="text-xs font-medium text-muted-foreground">Coach response:</p>
              <p className="text-sm">{truncateText(review.coachResponse, 150)}</p>
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="text-sm text-muted-foreground">{formatDate(review.createdAt)}</span>
          <ReviewVisibilityToggle
            reviewId={review.id}
            isPublic={review.isPublic}
            onToggle={onToggleVisibility}
          />
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  rating,
  visibility,
}: {
  currentPage: number;
  totalPages: number;
  rating: string;
  visibility: string;
}) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    if (rating && rating !== 'all') params.set('rating', rating);
    if (visibility && visibility !== 'all') params.set('visibility', visibility);
    params.set('page', String(page));
    return `/admin/reviews?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildUrl(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        )}
        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildUrl(currentPage + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rating = params.rating || 'all';
  const visibility = params.visibility || 'all';
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const ratingFilter = rating !== 'all' ? parseInt(rating, 10) : undefined;

  const [{ reviews: reviewList, totalCount, totalPages, currentPage }, stats] = await Promise.all([
    getReviews({
      rating: ratingFilter,
      visibility,
      page,
      limit: REVIEWS_PER_PAGE,
    }),
    getReviewStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Moderation</h1>
        <p className="text-muted-foreground">Monitor and moderate client reviews</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Public</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.public}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hidden</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.hidden}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.averageRating}</span>
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Filter reviews by rating or visibility status</CardDescription>
        </CardHeader>
        <CardContent>
          <SearchFilters currentRating={rating} currentVisibility={visibility} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Reviews</CardTitle>
              <CardDescription>
                {totalCount} review{totalCount !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {reviewList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No reviews found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your filter criteria
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {reviewList.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  onToggleVisibility={toggleReviewVisibility}
                />
              ))}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            rating={rating}
            visibility={visibility}
          />
        </CardContent>
      </Card>
    </div>
  );
}
