import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-gold/10 text-gold-dark hover:bg-gold/20 border-gold/30',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-burgundy/10 text-burgundy hover:bg-burgundy/15 border-burgundy/30',
  },
  completed: {
    label: 'Completed',
    className: 'bg-sage/10 text-sage hover:bg-sage/15 border-sage/30',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground line-through border-transparent',
  },
  no_show: {
    label: 'No Show',
    className: 'bg-destructive/10 text-destructive border-transparent',
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
