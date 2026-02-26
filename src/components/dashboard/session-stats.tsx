import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, BarChart3, Bell } from 'lucide-react';

interface SessionStatsProps {
  distinctClients: number;
  sessionsThisMonth: number;
  totalSessions: number;
  pendingBookingRequests?: number;
}

export function SessionStats({
  distinctClients,
  sessionsThisMonth,
  totalSessions,
  pendingBookingRequests = 0,
}: SessionStatsProps) {
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
          {pendingBookingRequests > 0 && (
            <Link
              href="/dashboard/sessions?tab=upcoming"
              className="flex items-center justify-between rounded-md bg-amber-50 p-2 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                <Bell className="h-4 w-4" />
                Pending Requests
              </div>
              <Badge variant="secondary" className="bg-amber-200 text-amber-900">
                {pendingBookingRequests}
              </Badge>
            </Link>
          )}
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
