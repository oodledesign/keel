import type { CommercialPipelineStage } from '~/lib/commercial/commercial-constants';

export type InsightsPeriod = '7d' | '30d' | 'quarter';

export type CommercialReportsMetrics = {
  stockOnMarket: number;
  underOffer: number;
  unactionedEnquiries: number;
  upcomingViewings: number;
  awaitingFeedbackViewings: number;
  avgDaysOnMarket: number | null;
  pipelineByStage: Record<CommercialPipelineStage, number>;
};

export type DisposalInsightsKpi = {
  label: string;
  value: number;
  previousValue: number;
  format: 'number' | 'sqft' | 'days' | 'percent';
};

export type DisposalInsightsChartPoint = {
  key: string;
  label: string;
  current: number;
  previous: number;
};

export type DisposalInsightsStatusSlice = {
  key: string;
  label: string;
  count: number;
};

export type DisposalInsightsTeamRow = {
  key: string;
  name: string;
  count: number;
  totalSqft: number;
};

export type DisposalInsights = {
  period: InsightsPeriod;
  periodLabel: string;
  compareEnabled: boolean;
  disposalType: 'to_let' | 'for_sale' | 'all';
  kpis: {
    newInstructions: DisposalInsightsKpi;
    totalSizeSqft: DisposalInsightsKpi;
    avgSizeSqft: DisposalInsightsKpi;
    avgDaysOnMarket: DisposalInsightsKpi;
  };
  sizeBands: DisposalInsightsChartPoint[];
  statusBreakdown: DisposalInsightsStatusSlice[];
  newOverTime: DisposalInsightsChartPoint[];
  team: DisposalInsightsTeamRow[];
};

export type ViewingInsightsBreakdownRow = {
  key: string;
  label: string;
  count: number;
  totalSqft: number;
  avgSqft: number;
};

export type ViewingInsights = {
  period: InsightsPeriod;
  periodLabel: string;
  kpis: {
    total: DisposalInsightsKpi;
    positive: DisposalInsightsKpi;
    neutral: DisposalInsightsKpi;
    negative: DisposalInsightsKpi;
    awaitingFeedback: DisposalInsightsKpi;
    cancelled: DisposalInsightsKpi;
  };
  bySector: ViewingInsightsBreakdownRow[];
  bySource: ViewingInsightsBreakdownRow[];
  byAgent: ViewingInsightsBreakdownRow[];
  overTime: DisposalInsightsChartPoint[];
};

export type InboundInsights = {
  period: InsightsPeriod;
  periodLabel: string;
  kpis: {
    newEnquiries: DisposalInsightsKpi;
    unactioned: DisposalInsightsKpi;
    actioned: DisposalInsightsKpi;
    avgDaysToAction: DisposalInsightsKpi;
    archived: DisposalInsightsKpi;
    stalePercent: DisposalInsightsKpi;
  };
  byStatus: DisposalInsightsStatusSlice[];
  overTime: DisposalInsightsChartPoint[];
};

export type RequirementInsights = {
  period: InsightsPeriod;
  periodLabel: string;
  kpis: {
    active: DisposalInsightsKpi;
    onHold: DisposalInsightsKpi;
    archived: DisposalInsightsKpi;
    signed: DisposalInsightsKpi;
    avgAgeDays: DisposalInsightsKpi;
    stale: DisposalInsightsKpi;
  };
  byStage: DisposalInsightsStatusSlice[];
  qualification: DisposalInsightsStatusSlice[];
  funnel: Array<{ key: string; label: string; count: number }>;
  conversionRate: number;
};

export type SourceInsightsRow = {
  key: string;
  label: string;
  leadCount: number;
  previousLeadCount: number;
  volumeSqft: number;
  previousVolumeSqft: number;
};

export type SourceInsights = {
  period: InsightsPeriod;
  periodLabel: string;
  rows: SourceInsightsRow[];
  totalLeads: DisposalInsightsKpi;
  totalVolumeSqft: DisposalInsightsKpi;
};

export type TransactionInsights = {
  period: InsightsPeriod;
  periodLabel: string;
  kind: 'lettings' | 'sales';
  kpis: {
    totalDeals: DisposalInsightsKpi;
    avgSizeSqft: DisposalInsightsKpi;
    avgRentPsf: DisposalInsightsKpi;
    avgLeaseYears: DisposalInsightsKpi;
    avgDisposalDaysToClose: DisposalInsightsKpi;
    avgRequirementDaysToClose: DisposalInsightsKpi;
  };
  bySource: ViewingInsightsBreakdownRow[];
};

export type InsightsTab =
  | 'disposals'
  | 'viewings'
  | 'requirements'
  | 'inbound'
  | 'sources'
  | 'transactions';

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatInsightsDelta(
  current: number,
  previous: number,
): { label: string; positive: boolean | null } {
  const pct = percentChange(current, previous);
  if (pct == null) {
    return {
      label: previous === 0 && current > 0 ? 'New' : '—',
      positive: null,
    };
  }
  const rounded = Math.round(pct * 100) / 100;
  return {
    label: `${rounded > 0 ? '+' : ''}${rounded}%`,
    positive: rounded === 0 ? null : rounded > 0,
  };
}
