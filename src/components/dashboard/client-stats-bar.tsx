import { Card, CardContent } from '@/components/ui/card';
import { Users, Calendar, CheckCircle, ClipboardList } from 'lucide-react';

interface ClientStatsBarProps {
  coachCount: number;
  upcomingSessions: number;
  completedSessions: number;
  pendingActionItems: number;
}

const stats = [
  {
    key: 'coaches',
    label: 'My Coaches',
    icon: Users,
    colorClass: 'bg-burgundy/10 text-burgundy',
  },
  {
    key: 'upcoming',
    label: 'Upcoming Sessions',
    icon: Calendar,
    colorClass: 'bg-gold/10 text-gold-dark',
  },
  {
    key: 'completed',
    label: 'Completed Sessions',
    icon: CheckCircle,
    colorClass: 'bg-sage/10 text-sage',
  },
  {
    key: 'actions',
    label: 'Pending Actions',
    icon: ClipboardList,
    colorClass: 'bg-burgundy-light/10 text-burgundy-light',
  },
] as const;

export function ClientStatsBar({
  coachCount,
  upcomingSessions,
  completedSessions,
  pendingActionItems,
}: ClientStatsBarProps) {
  const values: Record<string, string> = {
    coaches: String(coachCount),
    upcoming: String(upcomingSessions),
    completed: String(completedSessions),
    actions: String(pendingActionItems),
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
