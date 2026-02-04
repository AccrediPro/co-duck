import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, BarChart3 } from 'lucide-react';

interface SessionStatsProps {
  distinctClients: number;
  sessionsThisMonth: number;
  totalSessions: number;
}

export function SessionStats({ distinctClients, sessionsThisMonth, totalSessions }: SessionStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Session Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Total Clients
            </div>
            <span className="text-lg font-semibold">{distinctClients}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              This Month
            </div>
            <span className="text-lg font-semibold">{sessionsThisMonth}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Total Sessions
            </div>
            <span className="text-lg font-semibold">{totalSessions}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
