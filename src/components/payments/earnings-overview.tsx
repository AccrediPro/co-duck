'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';
import type { EarningsData } from '@/app/(dashboard)/dashboard/payments/actions';

interface EarningsOverviewProps {
  earnings: EarningsData;
}

function formatCurrency(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function EarningsOverview({ earnings }: EarningsOverviewProps) {
  const { totalEarnings, thisMonthEarnings, pendingPayouts, currency } = earnings;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Total Earnings Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalEarnings, currency)}</div>
          <p className="text-xs text-muted-foreground">All time earnings after platform fees</p>
        </CardContent>
      </Card>

      {/* This Month Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(thisMonthEarnings, currency)}</div>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </CardContent>
      </Card>

      {/* Pending Payouts Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(pendingPayouts, currency)}</div>
          <p className="text-xs text-muted-foreground">Awaiting payment processing</p>
        </CardContent>
      </Card>
    </div>
  );
}
