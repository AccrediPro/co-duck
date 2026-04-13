import * as React from 'react';
import { cn } from '@/lib/utils';
import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerifiedBadgeProps {
  /** Size variant of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the "Verified" text label */
  showLabel?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * VerifiedBadge Component
 *
 * Displays a verification badge for coaches who have been verified by admins.
 * Includes a tooltip explaining what verification means.
 *
 * @example
 * // Icon only (default)
 * <VerifiedBadge />
 *
 * @example
 * // With label
 * <VerifiedBadge showLabel />
 *
 * @example
 * // Large size with label
 * <VerifiedBadge size="lg" showLabel />
 */
export const VerifiedBadge = React.forwardRef<HTMLDivElement, VerifiedBadgeProps>(
  ({ size = 'md', showLabel = false, className }, ref) => {
    const sizeClasses = {
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    const textSizeClasses = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={ref}
              className={cn(
                'inline-flex items-center gap-1 text-[hsl(var(--brand-warm))]',
                className
              )}
            >
              <BadgeCheck
                className={cn(sizeClasses[size], 'fill-[hsl(var(--brand-warm))] text-white')}
              />
              {showLabel && (
                <span className={cn('font-medium', textSizeClasses[size])}>Verified</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Verified coach - identity and credentials confirmed</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

VerifiedBadge.displayName = 'VerifiedBadge';
