'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StarRating } from '@/components/ui/star-rating';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';

export interface ReviewCardProps extends React.HTMLAttributes<HTMLDivElement> {
  rating: number;
  reviewTitle?: string | null;
  reviewContent?: string | null;
  clientName: string;
  createdAt: Date | string;
  coachResponse?: string | null;
}

const ReviewCard = React.forwardRef<HTMLDivElement, ReviewCardProps>(
  (
    {
      rating,
      reviewTitle,
      reviewContent,
      clientName,
      createdAt,
      coachResponse,
      className,
      ...props
    },
    ref
  ) => {
    const formattedDate = formatDate(createdAt);

    return (
      <Card ref={ref} className={cn('', className)} {...props}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <StarRating rating={rating} size="sm" />
              {reviewTitle && <h4 className="font-semibold leading-tight">{reviewTitle}</h4>}
            </div>
            <div className="shrink-0 text-right text-sm text-muted-foreground">
              <p className="font-medium">{clientName}</p>
              <p>{formattedDate}</p>
            </div>
          </div>
        </CardHeader>
        {(reviewContent || coachResponse) && (
          <CardContent className="pt-0">
            {reviewContent && <p className="text-sm text-muted-foreground">{reviewContent}</p>}
            {coachResponse && (
              <div className="mt-4 rounded-lg bg-muted p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Coach&apos;s Response</p>
                <p className="text-sm">{coachResponse}</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  }
);
ReviewCard.displayName = 'ReviewCard';

export { ReviewCard };
