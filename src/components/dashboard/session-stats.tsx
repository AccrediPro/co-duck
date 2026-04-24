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
    <Card className="border-t-4 border-t-burgundy">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="rounded-full bg-burgundy/10 p-1.5">
            <BarChart3 className="h-4 w-4 text-burgundy" />
          </div>
          Session Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingBookingRequests > 0 && (
            <Link
              href="/dashboard/sessions?tab=upcoming"
              className="flex items-center justify-between rounded-md bg-gold/10 p-2 transition-colors hover:bg-gold/20"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gold-dark">
                <Bell className="h-4 w-4" />
                Pending Requests
              </div>
              <Badge variant="secondary" className="bg-gold/20 text-gold-dark">
                {pendingBookingRequests}
              </Badge>
            </Link>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="rounded-full bg-burgundy/10 p-1">
                <Users className="h-3.5 w-3.5 text-burgundy" />
              </div>
              Total Clients
            </div>
            <span className="text-xl font-bold text-burgundy-dark">{distinctClients}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="rounded-full bg-sage/10 p-1">
                <Calendar className="h-3.5 w-3.5 text-sage" />
              </div>
              This Month
            </div>
            <span className="text-xl font-bold text-burgundy-dark">{sessionsThisMonth}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="rounded-full bg-gold/10 p-1">
                <BarChart3 className="h-3.5 w-3.5 text-gold-dark" />
              </div>
              Total Sessions
            </div>
            <span className="text-xl font-bold text-burgundy-dark">{totalSessions}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
