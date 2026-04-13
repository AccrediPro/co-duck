'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  createStripeConnectAccount,
  generateOnboardingLink,
  type StripeOnboardingStatus,
  type EarningsData,
  type TransactionWithClient,
} from '@/app/(dashboard)/dashboard/payments/actions';
import { EarningsOverview } from './earnings-overview';
import { TransactionsList } from './transactions-list';

interface PaymentsContentProps {
  initialData: {
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
    onboardingStatus: StripeOnboardingStatus;
  };
  setupStatus?: string;
  earningsData?: {
    earnings: EarningsData;
    transactions: TransactionWithClient[];
    totalCount: number;
    page: number;
    pageSize: number;
  } | null;
}

export function PaymentsContent({ initialData, setupStatus, earningsData }: PaymentsContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(initialData.onboardingStatus);

  // Handle setup status from URL params
  useEffect(() => {
    if (setupStatus === 'complete') {
      // Refresh the page data to get updated status
      router.refresh();
      toast({
        title: 'Onboarding Progress Saved',
        description: initialData.stripeOnboardingComplete
          ? 'Your payment account is now fully set up!'
          : 'Your progress has been saved. Complete any remaining steps to start receiving payments.',
      });
      // Clear the URL param
      router.replace('/dashboard/payments');
    } else if (setupStatus === 'refresh') {
      toast({
        title: 'Session Expired',
        description: 'Your onboarding session expired. Click the button below to continue.',
        variant: 'destructive',
      });
      // Clear the URL param
      router.replace('/dashboard/payments');
    }
  }, [setupStatus, initialData.stripeOnboardingComplete, router, toast]);

  // Update status when initialData changes
  useEffect(() => {
    setOnboardingStatus(initialData.onboardingStatus);
  }, [initialData.onboardingStatus]);

  const handleStartOnboarding = async () => {
    setIsLoading(true);
    try {
      const result = await createStripeConnectAccount();
      if (result.success) {
        // Redirect to Stripe onboarding
        window.location.href = result.accountLinkUrl;
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setIsLoading(true);
    try {
      const result = await generateOnboardingLink();
      if (result.success) {
        // Redirect to Stripe onboarding
        window.location.href = result.url;
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (onboardingStatus) {
      case 'complete':
        return (
          <Badge
            variant="default"
            className="bg-[hsl(var(--brand-accent))] hover:bg-[hsl(var(--brand-warm))]"
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-gold/10 text-gold-dark">
            <Clock className="mr-1 h-3 w-3" />
            Pending Setup
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="mr-1 h-3 w-3" />
            Not Started
          </Badge>
        );
    }
  };

  const getStatusIcon = () => {
    switch (onboardingStatus) {
      case 'complete':
        return <CheckCircle className="h-12 w-12 text-[hsl(var(--brand-accent))]" />;
      case 'pending':
        return <Clock className="h-12 w-12 text-gold" />;
      default:
        return <CreditCard className="h-12 w-12 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Earnings Overview - Only show when Stripe is connected */}
      {onboardingStatus === 'complete' && earningsData && (
        <EarningsOverview earnings={earningsData.earnings} />
      )}

      {/* Stripe Connect Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Processing</CardTitle>
              <CardDescription>
                {onboardingStatus === 'complete'
                  ? 'Your Stripe account is connected and ready to receive payments'
                  : 'Connect your Stripe account to receive payments from clients'}
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">{getStatusIcon()}</div>
            <div className="space-y-2">
              {onboardingStatus === 'not_started' && (
                <>
                  <h3 className="text-lg font-medium">Set Up Payment Processing</h3>
                  <p className="text-muted-foreground">
                    To receive payments from clients, you need to connect a Stripe account. This is
                    a quick process that verifies your identity and sets up your payout method.
                  </p>
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    <li>Securely process payments from clients</li>
                    <li>Receive automatic payouts to your bank account</li>
                    <li>Track your earnings in one place</li>
                  </ul>
                </>
              )}

              {onboardingStatus === 'pending' && (
                <>
                  <h3 className="text-lg font-medium">Complete Your Setup</h3>
                  <p className="text-muted-foreground">
                    You have started setting up your payment account but there are still some steps
                    remaining. Complete the setup to start receiving payments from clients.
                  </p>
                  <div className="mt-3 rounded-lg border border-gold/30 bg-gold/10 p-3">
                    <p className="text-sm text-gold-dark">
                      <AlertCircle className="mr-2 inline h-4 w-4" />
                      Your account setup is incomplete. Click below to continue where you left off.
                    </p>
                  </div>
                </>
              )}

              {onboardingStatus === 'complete' && (
                <>
                  <h3 className="text-lg font-medium">Payment Processing Active</h3>
                  <p className="text-muted-foreground">
                    Your Stripe account is fully set up and ready to receive payments. Clients can
                    now book and pay for sessions with you.
                  </p>
                  <div className="mt-3 rounded-lg border border-[hsl(var(--brand-border))] bg-[hsl(var(--brand-surface))] p-3 dark:border-[hsl(var(--brand-accent-darker))] dark:bg-[hsl(var(--brand-accent-deep))]">
                    <p className="text-sm text-[hsl(var(--brand-accent-dark))] dark:text-[hsl(var(--brand-border))]">
                      <CheckCircle className="mr-2 inline h-4 w-4" />
                      Your account is verified and ready to accept payments.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {onboardingStatus === 'not_started' && (
              <Button onClick={handleStartOnboarding} disabled={isLoading} className="min-h-[44px]">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Up...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Set Up Payments
                  </>
                )}
              </Button>
            )}

            {onboardingStatus === 'pending' && (
              <Button
                onClick={handleContinueOnboarding}
                disabled={isLoading}
                className="min-h-[44px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Continue Setup
                  </>
                )}
              </Button>
            )}

            {onboardingStatus === 'complete' && (
              <Button variant="outline" asChild className="min-h-[44px]">
                <a
                  href="https://dashboard.stripe.com/express"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Stripe Dashboard
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions List - Only show when Stripe is connected */}
      {onboardingStatus === 'complete' && earningsData && (
        <TransactionsList
          initialTransactions={earningsData.transactions}
          totalCount={earningsData.totalCount}
          initialPage={earningsData.page}
          pageSize={earningsData.pageSize}
          currency={earningsData.earnings.currency}
        />
      )}

      {/* Info Card - Only show when not connected */}
      {onboardingStatus !== 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About Stripe Connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We use Stripe Connect to securely handle payments. Your financial information is
              stored directly with Stripe, not on our platform.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Secure Payments</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  All transactions are processed securely through Stripe, a PCI-compliant payment
                  processor.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Fast Payouts</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Receive payouts directly to your bank account, typically within 2-7 business days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
