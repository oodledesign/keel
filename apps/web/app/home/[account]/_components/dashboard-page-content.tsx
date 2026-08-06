'use client';

import type {
  DashboardFinanceMonth,
  DashboardMetrics,
  DashboardNeedsReplySummary,
  DashboardNoteSummary,
  DashboardSuggestedEmailTasksSummary,
  DashboardSupportTicketsSummary,
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
  openSupportTickets: DashboardSupportTicketsSummary;
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
  openSupportTickets,
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
      openSupportTickets={openSupportTickets}
      recentNotes={recentNotes}
      shortcutsBar={shortcutsBar}
    />
  );
}
