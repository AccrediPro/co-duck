import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: {
    label: 'Confirmed',
    className:
      'bg-[hsl(var(--brand-accent))] hover:bg-[hsl(var(--brand-warm))] text-white border-transparent',
  },
  pending: {
    label: 'Pending',
    className: 'bg-gold/15 text-gold-dark hover:bg-gold/25 border-transparent',
  },
  completed: {
    label: 'Completed',
    className: 'border-[hsl(var(--brand-accent))] text-[hsl(var(--brand-warm))] bg-transparent',
  },
  cancelled: {
    label: 'Cancelled',
    className:
      'bg-red-100 text-red-600 hover:bg-red-200 border-transparent dark:bg-red-900/30 dark:text-red-400',
  },
  no_show: {
    label: 'No Show',
    className: 'border-gray-400 text-gray-500 bg-transparent',
  },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status as BookingStatus];
  const displayLabel = label ?? config?.label ?? status;
  const statusClassName =
    config?.className ?? 'bg-secondary text-secondary-foreground border-transparent';

  return <Badge className={cn(statusClassName, className)}>{displayLabel}</Badge>;
}
