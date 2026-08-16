import type { DashboardPresetId } from '~/config/dashboard-presets.config';
import type { DayViewPipeline } from '~/lib/planner/types';

import type {
  DashboardFinanceMonth,
  DashboardInvoiceSummary,
  DashboardJobSummary,
  DashboardMetrics,
  DashboardNeedsReplySummary,
  DashboardNoteSummary,
  DashboardStatusSummary,
  DashboardSuggestedEmailTasksSummary,
  DashboardSupportTicketsSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { BusinessDashboardMobile } from './business-dashboard-mobile';
import { DashboardLayoutControl } from './dashboard-layout-control';
import { DashboardPresetOnboardingDialog } from './dashboard-preset-onboarding-dialog';

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
  pipeline: DayViewPipeline | null;
  activeJobsList: DashboardJobSummary[];
  statusSummary: DashboardStatusSummary;
  teamMembers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string | null;
  }>;
  recentInvoices: DashboardInvoiceSummary[];
  presetId: DashboardPresetId | null;
  recommendedPresetId: DashboardPresetId;
  showPresetOnboarding: boolean;
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
  pipeline,
  activeJobsList,
  statusSummary,
  teamMembers,
  recentInvoices,
  presetId,
  recommendedPresetId,
  showPresetOnboarding,
  shortcutsBar,
}: DashboardPageContentProps) {
  return (
    <>
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
        pipeline={pipeline}
        activeJobsList={activeJobsList}
        statusSummary={statusSummary}
        teamMembers={teamMembers}
        recentInvoices={recentInvoices}
        presetId={presetId}
        shortcutsBar={shortcutsBar}
        layoutControl={
          <DashboardLayoutControl
            accountId={accountId}
            accountSlug={accountSlug}
            activePresetId={presetId}
            recommendedPresetId={recommendedPresetId}
          />
        }
      />
      <DashboardPresetOnboardingDialog
        accountId={accountId}
        accountSlug={accountSlug}
        recommendedPresetId={recommendedPresetId}
        open={showPresetOnboarding}
      />
    </>
  );
}
