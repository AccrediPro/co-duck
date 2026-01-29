'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { createRetryCheckoutSession } from '@/app/(dashboard)/dashboard/my-sessions/actions';

export type PaymentStatus = 'free' | 'paid' | 'payment_required' | 'payment_failed';

interface Transaction {
  id: number;
  amountCents: number;
  currency: string;
  platformFeeCents: number;
  coachPayoutCents: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  createdAt: Date;
  stripePaymentIntentId: string | null;
}

interface PaymentSectionProps {
  sessionId: number;
  paymentStatus: PaymentStatus;
  transaction: Transaction | null;
  sessionPrice: number;
  isUpcoming: boolean;
  isClientView: boolean;
}

export function PaymentSection({
  sessionId,
  paymentStatus,
  transaction,
  sessionPrice,
  isUpcoming,
  isClientView,
}: PaymentSectionProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Don't show payment section for free sessions
  if (paymentStatus === 'free' || sessionPrice === 0) {
    return null;
  }

  const formatPrice = (cents: number, currency: string = 'usd') => {
    const symbol = currency.toLowerCase() === 'usd' ? '$' : currency.toUpperCase() + ' ';
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  const handlePayNow = async () => {
    setIsLoading(true);
    try {
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await createRetryCheckoutSession(sessionId, clientTimezone);

      if (result.success) {
        window.location.href = result.checkoutUrl;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create checkout session',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentStatusBadge = () => {
    switch (paymentStatus) {
      case 'paid':
        return (
          <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">
            <CheckCircle className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case 'payment_required':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            <AlertCircle className="mr-1 h-3 w-3" />
            Payment Required
          </Badge>
        );
      case 'payment_failed':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-700">
            <AlertCircle className="mr-1 h-3 w-3" />
            Payment Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Information
          </CardTitle>
          {getPaymentStatusBadge()}
        </div>
        <CardDescription>
          {paymentStatus === 'paid'
            ? 'Payment has been received for this session'
            : isClientView
              ? 'Complete your payment to confirm this booking'
              : 'Waiting for client payment'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transaction details when payment is completed */}
        {transaction && paymentStatus === 'paid' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount Paid</span>
              <span className="font-medium">
                {formatPrice(transaction.amountCents, transaction.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment Date</span>
              <span className="font-medium">
                {format(new Date(transaction.createdAt), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {/* Only show payout info to coach */}
            {!isClientView && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Your Payout</span>
                <span className="font-medium text-green-600">
                  {formatPrice(transaction.coachPayoutCents, transaction.currency)}
                </span>
              </div>
            )}
            {transaction.stripePaymentIntentId && isClientView && (
              <div className="mt-4">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://dashboard.stripe.com/payments/${transaction.stripePaymentIntentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Receipt
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Payment required state */}
        {(paymentStatus === 'payment_required' || paymentStatus === 'payment_failed') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount Due</span>
              <span className="text-lg font-semibold">{formatPrice(sessionPrice)}</span>
            </div>

            {paymentStatus === 'payment_failed' && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Your previous payment attempt was unsuccessful. Please try again with a different
                payment method.
              </div>
            )}

            {/* Only show Pay Now to client and for upcoming sessions */}
            {isClientView && isUpcoming && (
              <Button
                onClick={handlePayNow}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {isLoading ? 'Redirecting...' : 'Pay Now'}
              </Button>
            )}

            {!isClientView && (
              <p className="text-sm text-muted-foreground">
                The client has not yet completed payment for this session.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
