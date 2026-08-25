import type { DashboardPresetId } from '~/config/dashboard-presets.config';
import type { DayViewPipeline } from '~/lib/planner/types';

import type {
  DashboardFinanceMonth,
  DashboardInvoiceSummary,
  DashboardJobSummary,
  DashboardMeetingReviewSummary,
  DashboardMetrics,
  DashboardNeedsReplySummary,
  DashboardNoteSummary,
  DashboardStatusSummary,
  DashboardSuggestedEmailTasksSummary,
  DashboardSupportTicketsSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { BusinessDashboardMobile } from './business-dashboard-mobile';
import { DashboardPresetOnboardingDialog } from './dashboard-preset-onboarding-dialog';
import { DashboardWorkHomeHeader } from './dashboard-work-home-header';

type DashboardPageContentProps = {
  accountSlug: string;
  accountId: string;
  metrics: DashboardMetrics;
  financeTrend: DashboardFinanceMonth[];
  upcomingTasks: DashboardTaskSummary[];
  upcomingTasksTotalCount: number;
  needsReply: DashboardNeedsReplySummary;
  suggestedEmailTasks: DashboardSuggestedEmailTasksSummary;
  meetingTaskReview: DashboardMeetingReviewSummary;
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
  upcomingTasksTotalCount,
  needsReply,
  suggestedEmailTasks,
  meetingTaskReview,
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
      <DashboardWorkHomeHeader
        accountId={accountId}
        accountSlug={accountSlug}
        activePresetId={presetId}
        recommendedPresetId={recommendedPresetId}
      />
      <BusinessDashboardMobile
        accountSlug={accountSlug}
        accountId={accountId}
        metrics={metrics}
        financeTrend={financeTrend}
        upcomingTasks={upcomingTasks}
        upcomingTasksTotalCount={upcomingTasksTotalCount}
        needsReply={needsReply}
        suggestedEmailTasks={suggestedEmailTasks}
        meetingTaskReview={meetingTaskReview}
        openSupportTickets={openSupportTickets}
        recentNotes={recentNotes}
        pipeline={pipeline}
        activeJobsList={activeJobsList}
        statusSummary={statusSummary}
        teamMembers={teamMembers}
        recentInvoices={recentInvoices}
        presetId={presetId}
        shortcutsBar={shortcutsBar}
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
