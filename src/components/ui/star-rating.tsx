'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Star SVG icon component
function StarIcon({
  filled,
  half,
  className,
}: {
  filled: boolean;
  half?: boolean;
  className?: string;
}) {
  if (half) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="half-star-gradient">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="url(#half-star-gradient)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Display component for showing star ratings (read-only)
export interface StarRatingProps extends React.HTMLAttributes<HTMLDivElement> {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

const sizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const StarRating = React.forwardRef<HTMLDivElement, StarRatingProps>(
  ({ rating, maxRating = 5, size = 'md', showValue = false, className, ...props }, ref) => {
    const stars = [];

    for (let i = 1; i <= maxRating; i++) {
      const filled = i <= Math.floor(rating);
      const half = !filled && i === Math.ceil(rating) && rating % 1 >= 0.25 && rating % 1 < 0.75;
      const almostFilled = !filled && !half && i === Math.ceil(rating) && rating % 1 >= 0.75;

      stars.push(
        <StarIcon
          key={i}
          filled={filled || almostFilled}
          half={half}
          className={cn(
            sizeClasses[size],
            filled || almostFilled || half ? 'text-gold' : 'text-gray-300'
          )}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-0.5', className)}
        role="img"
        aria-label={`Rating: ${rating} out of ${maxRating} stars`}
        {...props}
      >
        {stars}
        {showValue && (
          <span className="ml-1.5 text-sm font-medium text-muted-foreground">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
    );
  }
);
StarRating.displayName = 'StarRating';

// Interactive input component for selecting rating
export interface StarRatingInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  value: number;
  onChange: (value: number) => void;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const StarRatingInput = React.forwardRef<HTMLDivElement, StarRatingInputProps>(
  ({ value, onChange, maxRating = 5, size = 'md', disabled = false, className, ...props }, ref) => {
    const [hoverValue, setHoverValue] = React.useState<number | null>(null);
    const displayValue = hoverValue ?? value;

    const handleKeyDown = (event: React.KeyboardEvent, starIndex: number) => {
      if (disabled) return;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          event.preventDefault();
          if (value < maxRating) {
            onChange(Math.min(maxRating, value + 1));
          }
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          event.preventDefault();
          if (value > 1) {
            onChange(Math.max(1, value - 1));
          }
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onChange(starIndex);
          break;
        case 'Home':
          event.preventDefault();
          onChange(1);
          break;
        case 'End':
          event.preventDefault();
          onChange(maxRating);
          break;
      }
    };

    const stars = [];
    for (let i = 1; i <= maxRating; i++) {
      const filled = i <= displayValue;
      const isActive = i === value;

      stars.push(
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(i)}
          onMouseEnter={() => !disabled && setHoverValue(i)}
          onMouseLeave={() => setHoverValue(null)}
          onFocus={() => !disabled && setHoverValue(i)}
          onBlur={() => setHoverValue(null)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={cn(
            'rounded-sm transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !disabled && 'cursor-pointer hover:scale-110',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          aria-label={`Rate ${i} out of ${maxRating} stars`}
          aria-pressed={isActive}
          tabIndex={isActive ? 0 : -1}
        >
          <StarIcon
            filled={filled}
            className={cn(
              sizeClasses[size],
              filled ? 'text-gold' : 'text-gray-300',
              !disabled && 'transition-colors'
            )}
          />
        </button>
      );
    }

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-1', className)}
        role="radiogroup"
        aria-label="Star rating"
        {...props}
      >
        {stars}
      </div>
    );
  }
);
StarRatingInput.displayName = 'StarRatingInput';

export { StarRating, StarRatingInput };
