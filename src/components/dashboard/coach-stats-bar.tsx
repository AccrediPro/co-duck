import { Card, CardContent } from '@/components/ui/card';
import { Users, Calendar, DollarSign, Star } from 'lucide-react';

interface CoachStatsBarProps {
  activeClients: number;
  sessionsThisMonth: number;
  revenueThisMonth: number;
  averageRating: number;
  currency: string;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const stats = [
  {
    key: 'clients',
    label: 'Active Clients',
    icon: Users,
    borderClass: 'border-l-burgundy',
    iconClass: 'text-burgundy',
  },
  {
    key: 'sessions',
    label: 'Sessions This Month',
    icon: Calendar,
    borderClass: 'border-l-sage',
    iconClass: 'text-sage',
  },
  {
    key: 'revenue',
    label: 'Revenue This Month',
    icon: DollarSign,
    borderClass: 'border-l-gold',
    iconClass: 'text-gold-dark',
  },
  {
    key: 'rating',
    label: 'Average Rating',
    icon: Star,
    borderClass: 'border-l-gold',
    iconClass: 'text-gold',
  },
] as const;

export function CoachStatsBar({
  activeClients,
  sessionsThisMonth,
  revenueThisMonth,
  averageRating,
  currency,
}: CoachStatsBarProps) {
  const values: Record<string, string> = {
    clients: String(activeClients),
    sessions: String(sessionsThisMonth),
    revenue: formatCurrency(revenueThisMonth, currency),
    rating: averageRating > 0 ? averageRating.toFixed(1) : '—',
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ key, label, icon: Icon, borderClass, iconClass }) => (
        <Card key={key} className={`border-l-4 shadow-sm ${borderClass}`}>
          <CardContent className="flex items-center gap-3 p-4">
            <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-foreground">{values[key]}</p>
              <p className="truncate text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
