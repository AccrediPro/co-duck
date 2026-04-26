import { ClientUpcomingSessions } from './client-upcoming-sessions';
import { FindCoachCta } from './find-coach-cta';
import { ActionItemsWidget } from './action-items-widget';
import { RecentMessagesWidget } from './recent-messages-widget';
import { ClientSessionHistory } from './client-session-history';
import { QuickActions } from './quick-actions';
import { ClientStatsBar } from './client-stats-bar';
import { ActivityFeed } from './activity-feed';
import { DailyTip } from './daily-tip';
import type { ClientDashboardData } from '@/app/(dashboard)/dashboard/actions';

interface ClientDashboardLayoutProps {
  data: ClientDashboardData;
}

export function ClientDashboardLayout({ data }: ClientDashboardLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <ClientStatsBar
        coachCount={data.distinctCoachCount}
        upcomingSessions={data.upcomingSessions.length}
        completedSessions={data.sessionHistory.completedCount}
        pendingActionItems={data.pendingActionItemsCount}
      />

      {/* Two-Column Asymmetric Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <ClientUpcomingSessions sessions={data.upcomingSessions} />
          <ActionItemsWidget
            count={data.pendingActionItemsCount}
            recentItems={data.recentActionItems}
          />
          <ClientSessionHistory
            completedCount={data.sessionHistory.completedCount}
            totalHours={data.sessionHistory.totalHours}
          />
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          <FindCoachCta />
          <ActivityFeed />
          <RecentMessagesWidget
            messages={data.recentMessages}
            unreadCount={data.unreadMessageCount}
          />
          <QuickActions role="client" />
          <DailyTip />
        </div>
      </div>
    </div>
  );
}
