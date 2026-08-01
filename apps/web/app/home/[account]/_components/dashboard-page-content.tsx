'use client';

import type {
  DashboardFinanceMonth,
  DashboardMetrics,
  DashboardNeedsReplySummary,
  DashboardNoteSummary,
  DashboardSuggestedEmailTasksSummary,
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
  suggestedEmailTasks: DashboardSuggestedEmailTasksSummary;
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
  suggestedEmailTasks,
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
      suggestedEmailTasks={suggestedEmailTasks}
      recentNotes={recentNotes}
      shortcutsBar={shortcutsBar}
    />
  );
}
