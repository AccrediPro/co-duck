import { TodaysSchedule } from './todays-schedule';
import { CalendarView } from './calendar-view';
import { UpcomingSessionsWidget } from './upcoming-sessions-widget';
import { RecentMessagesWidget } from './recent-messages-widget';
import { QuickActions } from './quick-actions';
import { CoachStatsBar } from './coach-stats-bar';
import { GettingStartedChecklist } from './getting-started-checklist';
import { ActivityFeed } from './activity-feed';
import { DailyTip } from './daily-tip';
import type { CoachDashboardData } from '@/app/(dashboard)/dashboard/actions';

interface CoachDashboardLayoutProps {
  data: CoachDashboardData;
}

export function CoachDashboardLayout({ data }: CoachDashboardLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <CoachStatsBar
        activeClients={data.sessionStats.distinctClients}
        sessionsThisMonth={data.sessionStats.sessionsThisMonth}
        revenueThisMonth={data.revenue.thisMonth}
        averageRating={data.averageRating}
        currency={data.revenue.currency}
      />

      {/* Two-Column Asymmetric Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <TodaysSchedule sessions={data.todaysSessions} />
          <CalendarView />
          <UpcomingSessionsWidget sessions={data.upcomingSessions} />
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          <GettingStartedChecklist />
          <ActivityFeed />
          <RecentMessagesWidget
            messages={data.recentMessages}
            unreadCount={data.unreadMessageCount}
          />
          <QuickActions role="coach" coachSlug={data.profile.slug} />
          <DailyTip />
        </div>
      </div>
    </div>
  );
}
