import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function OnboardingLoading() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-1 w-8" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-1 w-8" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-1 w-8" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Header */}
      <div className="mb-8 text-center">
        <Skeleton className="mx-auto h-8 w-64" />
        <Skeleton className="mx-auto mt-2 h-5 w-80" />
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form fields */}
          <div>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
