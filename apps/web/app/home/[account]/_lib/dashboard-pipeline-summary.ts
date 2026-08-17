import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import type { DayViewPipeline } from '~/lib/planner/types';

const PIPELINE_OPEN_STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call booked' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'negotiation', label: 'Negotiation' },
] as const;

export type DashboardPipelineDealRow = {
  id: string;
  stage: string | null;
  value: number | null;
  contact_name: string | null;
  company_name: string | null;
  next_action: string | null;
  next_action_date: string | null;
  updated_at?: string | null;
};

export function summariseDashboardPipeline(
  deals: DashboardPipelineDealRow[],
  href: string,
): DayViewPipeline | null {
  const openKeys = new Set(PIPELINE_OPEN_STAGES.map((s) => s.key));
  const openDeals = deals.filter(
    (deal) => deal.stage && openKeys.has(deal.stage),
  );
  if (openDeals.length === 0) return null;

  const stageLabel = (key: string) =>
    PIPELINE_OPEN_STAGES.find((s) => s.key === key)?.label ?? key;

  const stages = PIPELINE_OPEN_STAGES.map((stage) => {
    const stageDeals = openDeals.filter((deal) => deal.stage === stage.key);
    return {
      key: stage.key,
      label: stage.label,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0),
    };
  }).filter((stage) => stage.count > 0);

  const today = todayLocalYmd();
  const needsAction = openDeals
    .filter(
      (deal) =>
        Boolean(deal.next_action?.trim()) && Boolean(deal.next_action_date),
    )
    .filter((deal) => (deal.next_action_date as string) <= today)
    .sort((a, b) =>
      (a.next_action_date as string).localeCompare(
        b.next_action_date as string,
      ),
    )
    .slice(0, 4)
    .map((deal) => ({
      id: deal.id,
      name:
        [deal.contact_name, deal.company_name].filter(Boolean).join(' · ') ||
        'Untitled deal',
      stage: deal.stage ?? 'lead',
      stageLabel: stageLabel(deal.stage ?? 'lead'),
      nextAction: deal.next_action?.trim() || '',
      nextActionDate: deal.next_action_date,
      overdue: (deal.next_action_date as string) < today,
      value: deal.value ?? 0,
    }));

  return {
    href,
    openCount: openDeals.length,
    openValue: openDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0),
    stages,
    needsAction,
  };
}

export function hasRecentPipelineActivity(
  deals: DashboardPipelineDealRow[],
  withinDays = 14,
): boolean {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return deals.some((deal) => {
    if (!deal.updated_at) return false;
    const ts = new Date(deal.updated_at).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
}
