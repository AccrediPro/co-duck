import { Card } from '@/components/ui/card';

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />;
}

function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <SkeletonPulse className="h-9 w-9 flex-shrink-0 rounded-full" />
          <div className="space-y-1.5">
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        </div>
        <div className="space-y-2">
          <SkeletonPulse className="h-3.5 w-full" />
          <SkeletonPulse className="h-3.5 w-3/4" />
        </div>
      </div>
    </Card>
  );
}

export default function IConnectFeedLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <SkeletonPulse className="h-9 w-9 rounded" />
        <SkeletonPulse className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <SkeletonPulse className="h-5 w-32" />
          <SkeletonPulse className="h-3 w-20" />
        </div>
      </div>

      {/* Create post form skeleton */}
      <Card className="mb-6">
        <div className="p-4">
          <SkeletonPulse className="mb-3 h-9 w-full rounded-md" />
          <SkeletonPulse className="h-20 w-full rounded-md" />
        </div>
      </Card>

      {/* Post cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
