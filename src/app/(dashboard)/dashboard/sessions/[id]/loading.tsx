import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SessionDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <Skeleton className="mb-6 h-9 w-24" />

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Session Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="mt-1 h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="mt-1 h-5 w-32" />
                </div>
                <div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="mt-1 h-5 w-24" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-1 h-5 w-28" />
                </div>
                <div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="mt-1 h-5 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="mt-4 h-9 w-20" />
            </CardContent>
          </Card>

          {/* Meeting Link Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
