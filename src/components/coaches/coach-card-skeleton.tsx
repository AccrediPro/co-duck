import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CoachCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex flex-col items-center">
          {/* Avatar skeleton */}
          <Skeleton className="h-20 w-20 rounded-full" />

          {/* Name skeleton */}
          <Skeleton className="mt-4 h-6 w-32" />

          {/* Headline skeleton */}
          <Skeleton className="mt-2 h-4 w-48" />
          <Skeleton className="mt-1 h-4 w-40" />

          {/* Specialties skeleton */}
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Price skeleton */}
          <div className="mt-4 w-full border-t pt-4 text-center">
            <Skeleton className="mx-auto h-4 w-24" />
            <Skeleton className="mx-auto mt-1 h-7 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CoachGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <CoachCardSkeleton key={index} />
      ))}
    </div>
  );
}
