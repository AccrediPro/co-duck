import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';

interface RevenueStatsProps {
  thisMonth: number;
  total: number;
  pending: number;
  currency: string;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

export function RevenueStats({ thisMonth, total, pending, currency }: RevenueStatsProps) {
  return (
    <>
      <Card className="border-t-4 border-t-burgundy">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <div className="rounded-full bg-burgundy/10 p-2">
            <TrendingUp className="h-4 w-4 text-burgundy" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-burgundy-dark">
            {formatCurrency(thisMonth, currency)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Earnings this month</p>
        </CardContent>
      </Card>
      <Card className="border-t-4 border-t-sage">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <div className="rounded-full bg-sage/10 p-2">
            <DollarSign className="h-4 w-4 text-sage" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-burgundy-dark">
            {formatCurrency(total, currency)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">All time earnings</p>
        </CardContent>
      </Card>
      <Card className="border-t-4 border-t-gold">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <div className="rounded-full bg-gold/10 p-2">
            <Clock className="h-4 w-4 text-gold" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-burgundy-dark">
            {formatCurrency(pending, currency)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting payout</p>
        </CardContent>
      </Card>
    </>
  );
}
