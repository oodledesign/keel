'use client';

import type {
  DashboardFinanceMonth,
  DashboardMetrics,
  DashboardNeedsReplySummary,
  DashboardNoteSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { BusinessDashboardMobile } from './business-dashboard-mobile';

type DashboardPageContentProps = {
  accountSlug: string;
  accountId: string;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
  upcomingTasks: DashboardTaskSummary[];
  needsReply: DashboardNeedsReplySummary;
  recentNotes: DashboardNoteSummary[];
  shortcutsBar?: React.ReactNode;
};

export function DashboardPageContent({
  accountSlug,
  accountId,
  metrics,
  financeTrend,
  upcomingTasks,
  needsReply,
  recentNotes,
  shortcutsBar,
}: DashboardPageContentProps) {
  return (
    <BusinessDashboardMobile
      accountSlug={accountSlug}
      accountId={accountId}
      metrics={metrics}
      financeTrend={financeTrend}
      upcomingTasks={upcomingTasks}
      needsReply={needsReply}
      recentNotes={recentNotes}
      shortcutsBar={shortcutsBar}
    />
  );
}
