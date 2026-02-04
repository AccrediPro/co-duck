'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StarRatingInput } from '@/components/ui/star-rating';
import { cn } from '@/lib/utils';

export interface ReviewFormData {
  rating: number;
  title: string;
  content: string;
}

export interface ReviewFormProps extends Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  bookingId: number;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  isLoading?: boolean;
}

const ReviewForm = React.forwardRef<HTMLFormElement, ReviewFormProps>(
  ({ bookingId, onSubmit, isLoading = false, className, ...props }, ref) => {
    const [rating, setRating] = React.useState(0);
    const [title, setTitle] = React.useState('');
    const [content, setContent] = React.useState('');
    const [errors, setErrors] = React.useState<Partial<Record<keyof ReviewFormData, string>>>({});

    const validate = (): boolean => {
      const newErrors: Partial<Record<keyof ReviewFormData, string>> = {};

      if (rating === 0) {
        newErrors.rating = 'Please select a rating';
      }

      if (title.length > 100) {
        newErrors.title = 'Title must be 100 characters or less';
      }

      if (content.length > 1000) {
        newErrors.content = 'Review must be 1000 characters or less';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      await onSubmit({
        rating,
        title: title.trim(),
        content: content.trim(),
      });
    };

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn('space-y-6', className)}
        {...props}
      >
        <div className="space-y-2">
          <Label htmlFor="rating">Your Rating</Label>
          <div className="flex items-center gap-2">
            <StarRatingInput
              value={rating}
              onChange={setRating}
              size="lg"
              disabled={isLoading}
            />
            {rating > 0 && (
              <span className="text-sm text-muted-foreground">
                {rating} star{rating !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {errors.rating && (
            <p className="text-sm text-destructive">{errors.rating}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title (Optional)</Label>
          <Input
            id="title"
            placeholder="Summarize your experience"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            maxLength={100}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {title.length}/100 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Your Review (Optional)</Label>
          <Textarea
            id="content"
            placeholder="Share your experience with this coach..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isLoading}
            rows={4}
            maxLength={1000}
          />
          {errors.content && (
            <p className="text-sm text-destructive">{errors.content}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {content.length}/1000 characters
          </p>
        </div>

        <Button type="submit" disabled={isLoading || rating === 0}>
          {isLoading ? 'Submitting...' : 'Submit Review'}
        </Button>
      </form>
    );
  }
);
ReviewForm.displayName = 'ReviewForm';

export { ReviewForm };
