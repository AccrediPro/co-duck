import { ClientUpcomingSessions } from './client-upcoming-sessions';
import { FindCoachCta } from './find-coach-cta';
import { ActionItemsWidget } from './action-items-widget';
import { RecentMessagesWidget } from './recent-messages-widget';
import { ClientSessionHistory } from './client-session-history';
import { QuickActions } from './quick-actions';
import type { ClientDashboardData } from '@/app/(dashboard)/dashboard/actions';

interface ClientDashboardLayoutProps {
  data: ClientDashboardData;
}

export function ClientDashboardLayout({ data }: ClientDashboardLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Upcoming Sessions + Find a Coach CTA */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ClientUpcomingSessions sessions={data.upcomingSessions} />
        <FindCoachCta />
      </div>

      {/* Row 2: Action Items + Messages + Session History */}
      <div className="grid gap-4 md:grid-cols-3">
        <ActionItemsWidget
          count={data.pendingActionItemsCount}
          recentItems={data.recentActionItems}
        />
        <RecentMessagesWidget
          messages={data.recentMessages}
          unreadCount={data.unreadMessageCount}
        />
        <ClientSessionHistory
          completedCount={data.sessionHistory.completedCount}
          totalHours={data.sessionHistory.totalHours}
        />
      </div>

      {/* Row 3: Quick Actions */}
      <QuickActions role="client" />
    </div>
  );
}
