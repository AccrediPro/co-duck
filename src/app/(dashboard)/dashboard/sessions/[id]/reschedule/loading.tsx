import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function RescheduleLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <Skeleton className="mb-6 h-9 w-32" />

      <div className="mb-8 text-center">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="mx-auto mt-2 h-5 w-64" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-1 w-16" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-1 w-16" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>

          {/* Calendar Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              {/* Calendar skeleton */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-8 w-8" />
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={`header-${i}`} className="h-8 w-full" />
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={`day-${i}`} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Session Info */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1 h-5 w-32" />
              </div>
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-5 w-40" />
              </div>
              <div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1 h-5 w-28" />
              </div>
            </CardContent>
          </Card>

          {/* Policy Notice */}
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
