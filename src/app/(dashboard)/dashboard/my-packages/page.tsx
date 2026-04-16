'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PackageIcon, CalendarIcon } from 'lucide-react';

interface MyPackage {
  id: number;
  status: string;
  purchasedAt: string;
  expiresAt: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  totalPaidCents: number;
  packageId: number;
  coachId: string;
  packageTitle: string;
  packageSessionDuration: number;
  isExpired: boolean;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusVariant(
  status: string,
  isExpired: boolean
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (isExpired || status === 'expired') return 'destructive';
  if (status === 'completed') return 'secondary';
  if (status === 'refunded') return 'outline';
  return 'default';
}

export default function MyPackagesPage() {
  const [myPackages, setMyPackages] = useState<MyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/packages')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setMyPackages(data.data);
        else setError('Could not load your packages.');
      })
      .catch(() => setError('Could not load your packages.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Packages</h1>
        <p className="text-muted-foreground">
          View your purchased session bundles and remaining credits.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : myPackages.length === 0 ? (
        <Card className="py-12 text-center">
          <PackageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No packages yet</p>
          <p className="text-sm text-muted-foreground">
            Browse your coaches&apos; profiles to purchase a multi-session bundle.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {myPackages.map((pkg) => {
            const progressPct =
              pkg.totalSessions > 0 ? (pkg.usedSessions / pkg.totalSessions) * 100 : 0;
            const displayStatus = pkg.isExpired && pkg.status === 'active' ? 'expired' : pkg.status;

            return (
              <Card key={pkg.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{pkg.packageTitle}</CardTitle>
                    <Badge variant={statusVariant(pkg.status, pkg.isExpired)}>
                      {displayStatus}
                    </Badge>
                  </div>
                  <CardDescription>{pkg.packageSessionDuration}-min sessions</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-2">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Sessions used</span>
                      <span className="font-medium">
                        {pkg.usedSessions} / {pkg.totalSessions}
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pkg.remainingSessions} session{pkg.remainingSessions !== 1 ? 's' : ''}{' '}
                      remaining
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    <span>Expires {formatDate(pkg.expiresAt)}</span>
                  </div>

                  <p className="text-sm font-medium">{formatPrice(pkg.totalPaidCents)} paid</p>
                </CardContent>

                {pkg.remainingSessions > 0 && !pkg.isExpired && pkg.status === 'active' && (
                  <CardFooter>
                    <Button asChild size="sm" className="w-full">
                      <Link href="/coaches">Book a session</Link>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
