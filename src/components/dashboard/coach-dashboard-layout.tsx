import { TodaysSchedule } from './todays-schedule';
import { SessionStats } from './session-stats';
import { CalendarView } from './calendar-view';
import { UpcomingSessionsWidget } from './upcoming-sessions-widget';
import { RevenueStats } from './revenue-stats';
import { RecentMessagesWidget } from './recent-messages-widget';
import { QuickActions } from './quick-actions';
import type { CoachDashboardData } from '@/app/(dashboard)/dashboard/actions';

interface CoachDashboardLayoutProps {
  data: CoachDashboardData;
}

export function CoachDashboardLayout({ data }: CoachDashboardLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Today's Schedule + Session Stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TodaysSchedule sessions={data.todaysSessions} />
        <SessionStats
          distinctClients={data.sessionStats.distinctClients}
          sessionsThisMonth={data.sessionStats.sessionsThisMonth}
          totalSessions={data.sessionStats.totalSessions}
        />
      </div>

      {/* Row 2: Calendar + Upcoming Sessions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CalendarView />
        <UpcomingSessionsWidget sessions={data.upcomingSessions} />
      </div>

      {/* Row 3: Revenue + Messages + Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <RevenueStats
          thisMonth={data.revenue.thisMonth}
          total={data.revenue.total}
          pending={data.revenue.pending}
          currency={data.revenue.currency}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RecentMessagesWidget
          messages={data.recentMessages}
          unreadCount={data.unreadMessageCount}
        />
        <QuickActions role="coach" coachSlug={data.profile.slug} />
      </div>
    </div>
  );
}
