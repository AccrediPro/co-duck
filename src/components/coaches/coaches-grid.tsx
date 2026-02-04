'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CoachCard } from './coach-card';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { SessionType } from '@/db/schema';

export interface CoachListItem {
  userId: string;
  slug: string;
  headline: string | null;
  specialties: string[] | null;
  currency: string | null;
  sessionTypes: SessionType[] | null;
  averageRating: string | null;
  reviewCount: number | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  name: string | null;
  avatarUrl: string | null;
}

interface CoachesGridProps {
  coaches: CoachListItem[];
  totalCount: number;
  currentPage: number;
  perPage: number;
  showResultsCount?: boolean;
}

export function CoachesGrid({
  coaches,
  totalCount,
  currentPage,
  perPage,
  showResultsCount = true,
}: CoachesGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalCount / perPage);

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', page.toString());
    }
    router.push(`/coaches${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Empty state
  if (coaches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No coaches found</h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          There are no coaches available at the moment. Check back soon as new coaches join our
          platform regularly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results count */}
      {showResultsCount && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalCount)} of{' '}
          {totalCount} coach{totalCount !== 1 ? 'es' : ''}
        </p>
      )}

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((coach) => (
          <CoachCard
            key={coach.userId}
            name={coach.name || 'Coach'}
            avatarUrl={coach.avatarUrl}
            headline={coach.headline}
            specialties={coach.specialties}
            sessionTypes={coach.sessionTypes}
            currency={coach.currency}
            slug={coach.slug}
            averageRating={coach.averageRating}
            reviewCount={coach.reviewCount}
            isVerified={coach.verificationStatus === 'verified'}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {/* First page */}
            {currentPage > 3 && (
              <>
                <Button
                  variant={currentPage === 1 ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => goToPage(1)}
                  className="min-w-[36px]"
                >
                  1
                </Button>
                {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
              </>
            )}

            {/* Pages around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 7) return true;
                if (page >= currentPage - 2 && page <= currentPage + 2) return true;
                return false;
              })
              .map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => goToPage(page)}
                  className="min-w-[36px]"
                >
                  {page}
                </Button>
              ))}

            {/* Last page */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && (
                  <span className="px-2 text-muted-foreground">...</span>
                )}
                <Button
                  variant={currentPage === totalPages ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  className="min-w-[36px]"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
