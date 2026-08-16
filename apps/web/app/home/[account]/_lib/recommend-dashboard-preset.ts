import type { DashboardPresetId } from '~/config/dashboard-presets.config';

export type DashboardPresetRecommendationSignals = {
  accountRole: string | null | undefined;
  seatKind: string | null | undefined;
  hasRecentPipelineActivity: boolean;
  openSupportTicketCount: number;
  hasRecentInvoiceActivity: boolean;
};

/**
 * Deterministic preset recommendation — no ML.
 * Owner/admin → overview; recent pipeline → pipeline; support → tasks;
 * recent invoicing → finance; else overview.
 */
export function recommendDashboardPreset(
  signals: DashboardPresetRecommendationSignals,
): DashboardPresetId {
  const role = (signals.accountRole ?? '').toLowerCase();
  if (role === 'owner' || role === 'admin') {
    return 'overview';
  }

  if (signals.hasRecentPipelineActivity) {
    return 'pipeline';
  }

  if (
    signals.openSupportTicketCount > 0 ||
    (signals.seatKind ?? '').toLowerCase() === 'support'
  ) {
    return 'tasks';
  }

  if (signals.hasRecentInvoiceActivity) {
    return 'finance';
  }

  return 'overview';
}
