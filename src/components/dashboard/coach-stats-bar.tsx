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
    colorClass: 'bg-burgundy/10 text-burgundy',
  },
  {
    key: 'sessions',
    label: 'Sessions This Month',
    icon: Calendar,
    colorClass: 'bg-sage/10 text-sage',
  },
  {
    key: 'revenue',
    label: 'Revenue This Month',
    icon: DollarSign,
    colorClass: 'bg-gold/10 text-gold-dark',
  },
  {
    key: 'rating',
    label: 'Average Rating',
    icon: Star,
    colorClass: 'bg-burgundy-light/10 text-burgundy-light',
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
      {stats.map(({ key, label, icon: Icon, colorClass }) => (
        <Card key={key} className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-burgundy-dark">{values[key]}</p>
              <p className="truncate text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
