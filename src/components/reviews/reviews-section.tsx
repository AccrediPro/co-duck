'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import { ReviewCard } from './review-card';
import { Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Review {
  id: number;
  rating: number;
  title: string | null;
  content: string | null;
  coachResponse: string | null;
  createdAt: string;
  client: {
    name: string;
    avatarUrl: string | null;
  };
}

interface ReviewStats {
  averageRating: string | null;
  reviewCount: number | null;
}

interface ReviewsData {
  reviews: Review[];
  stats: ReviewStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReviewsSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  slug: string;
}

const ReviewsSection = React.forwardRef<HTMLDivElement, ReviewsSectionProps>(
  ({ slug, className, ...props }, ref) => {
    const [data, setData] = React.useState<ReviewsData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [page, setPage] = React.useState(1);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);

    // Fetch reviews
    const fetchReviews = React.useCallback(
      async (pageNum: number, append: boolean = false) => {
        try {
          if (append) {
            setIsLoadingMore(true);
          } else {
            setIsLoading(true);
          }

          const response = await fetch(`/api/coaches/${slug}/reviews?page=${pageNum}&limit=5`);
          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error?.message || 'Failed to fetch reviews');
          }

          setData((prev) => {
            if (append && prev) {
              return {
                ...result.data,
                reviews: [...prev.reviews, ...result.data.reviews],
              };
            }
            return result.data;
          });
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load reviews');
        } finally {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      },
      [slug]
    );

    // Initial fetch
    React.useEffect(() => {
      fetchReviews(1);
    }, [fetchReviews]);

    // Load more handler
    const handleLoadMore = () => {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchReviews(nextPage, true);
    };

    // Loading state
    if (isLoading) {
      return (
        <Card ref={ref} className={cn('', className)} {...props}>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      );
    }

    // Error state
    if (error) {
      return (
        <Card ref={ref} className={cn('', className)} {...props}>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      );
    }

    const hasReviews = data && data.reviews.length > 0;
    const hasMorePages = data && data.pagination.page < data.pagination.totalPages;
    const averageRating = data?.stats.averageRating ? parseFloat(data.stats.averageRating) : 0;
    const reviewCount = data?.stats.reviewCount || 0;

    return (
      <Card ref={ref} className={cn('', className)} {...props}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reviews</CardTitle>
            {hasReviews && (
              <div className="flex items-center gap-2">
                <StarRating rating={averageRating} size="sm" />
                <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasReviews ? (
            <div className="space-y-4">
              {data.reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  rating={review.rating}
                  reviewTitle={review.title}
                  reviewContent={review.content}
                  clientName={review.client.name}
                  createdAt={review.createdAt}
                  coachResponse={review.coachResponse}
                />
              ))}

              {hasMorePages && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Reviews'
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No reviews yet</p>
              <p className="text-sm text-muted-foreground">
                Be the first to share your experience with this coach
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
ReviewsSection.displayName = 'ReviewsSection';

export { ReviewsSection };
