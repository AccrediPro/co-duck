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
    borderClass: 'border-l-burgundy',
    iconClass: 'text-burgundy',
  },
  {
    key: 'upcoming',
    label: 'Upcoming Sessions',
    icon: Calendar,
    borderClass: 'border-l-gold',
    iconClass: 'text-gold-dark',
  },
  {
    key: 'completed',
    label: 'Completed Sessions',
    icon: CheckCircle,
    borderClass: 'border-l-sage',
    iconClass: 'text-sage',
  },
  {
    key: 'actions',
    label: 'Pending Actions',
    icon: ClipboardList,
    borderClass: 'border-l-gold',
    iconClass: 'text-gold',
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
