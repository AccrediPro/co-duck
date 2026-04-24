'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Receipt, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate as formatDateUS } from '@/lib/date-utils';
import type { TransactionWithClient } from '@/app/(dashboard)/dashboard/payments/actions';
import {
  getCoachEarnings,
  generateStripeDashboardLink,
} from '@/app/(dashboard)/dashboard/payments/actions';

interface TransactionsListProps {
  initialTransactions: TransactionWithClient[];
  totalCount: number;
  initialPage: number;
  pageSize: number;
  currency: string;
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

function formatDate(date: Date): string {
  return formatDateUS(date);
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

function getStatusBadge(status: TransactionWithClient['status']) {
  switch (status) {
    case 'succeeded':
      return (
        <Badge variant="default" className="border-sage/30 bg-sage/10 text-sage hover:bg-sage/15">
          Completed
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary" className="border-gold/30 bg-gold/10 text-gold-dark">
          Pending
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="border-transparent bg-destructive/10 text-destructive">Failed</Badge>
      );
    case 'refunded':
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          Refunded
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function TransactionsList({
  initialTransactions,
  totalCount,
  initialPage,
  pageSize,
  currency,
}: TransactionsListProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [page, setPage] = useState(initialPage);
  const [count, setCount] = useState(totalCount);
  const [isPending, startTransition] = useTransition();
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  const totalPages = Math.ceil(count / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, count);

  const handlePageChange = async (newPage: number) => {
    startTransition(async () => {
      const result = await getCoachEarnings(newPage, pageSize);
      if (result.success) {
        setTransactions(result.data.transactions);
        setPage(result.data.page);
        setCount(result.data.totalCount);
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleOpenStripeDashboard = async () => {
    setIsLoadingDashboard(true);
    try {
      const result = await generateStripeDashboardLink();
      if (result.success) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to open Stripe Dashboard',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  if (count === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your payment history will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No transactions yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              When clients book and pay for sessions, your transactions will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              Showing {startIndex}-{endIndex} of {count} transactions
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenStripeDashboard}
            disabled={isLoadingDashboard}
          >
            {isLoadingDashboard ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            View in Stripe
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Transactions list */}
          <div className="divide-y">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(transaction.clientName, transaction.clientEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {transaction.clientName || transaction.clientEmail || 'Unknown Client'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{transaction.sessionType}</span>
                      <span className="text-muted-foreground/50">-</span>
                      <span>{formatDate(transaction.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(transaction.coachPayoutCents, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(transaction.amountCents, currency)} total
                    </p>
                  </div>
                  {getStatusBadge(transaction.status)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || isPending}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || isPending}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
