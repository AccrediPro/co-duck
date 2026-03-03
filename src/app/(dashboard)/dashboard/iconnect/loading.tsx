import { Card, CardHeader } from '@/components/ui/card';

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />;
}

function ContactSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <SkeletonPulse className="h-12 w-12 flex-shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-3 w-12" />
        </div>
        <SkeletonPulse className="h-3.5 w-48" />
      </div>
    </div>
  );
}

export default function IConnectLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <SkeletonPulse className="h-7 w-32" />
          <SkeletonPulse className="mt-1.5 h-4 w-56" />
        </CardHeader>
      </Card>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ContactSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
