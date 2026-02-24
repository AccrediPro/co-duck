import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function FindCoachCta() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white">
        <h3 className="mb-2 text-lg font-semibold">Find Your Coach</h3>
        <p className="mb-4 text-sm text-emerald-100">
          Browse our directory of professional coaches and book your next session.
        </p>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/coaches">
            <Search className="mr-2 h-4 w-4" />
            Browse Coaches
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
