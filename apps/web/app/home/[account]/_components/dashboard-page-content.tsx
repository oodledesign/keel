'use client';

import type {
  DashboardFinanceMonth,
  DashboardMetrics,
  DashboardNoteSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { BusinessDashboardMobile } from './business-dashboard-mobile';

type DashboardPageContentProps = {
  accountSlug: string;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
  upcomingTasks: DashboardTaskSummary[];
  recentNotes: DashboardNoteSummary[];
  shortcutsBar?: React.ReactNode;
};

export function DashboardPageContent({
  accountSlug,
  metrics,
  financeTrend,
  upcomingTasks,
  recentNotes,
  shortcutsBar,
}: DashboardPageContentProps) {
  return (
    <BusinessDashboardMobile
      accountSlug={accountSlug}
      metrics={metrics}
      financeTrend={financeTrend}
      upcomingTasks={upcomingTasks}
      recentNotes={recentNotes}
      shortcutsBar={shortcutsBar}
    />
  );
}
