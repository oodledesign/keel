import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  COMMERCIAL_PIPELINE_STAGES,
  type CommercialPipelineStage,
  ENQUIRY_SOURCE_LABELS,
  type EnquirySource,
  type ListingStatus,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
  type ViewingOutcome,
} from '~/lib/commercial/commercial-constants';

import type {
  CommercialReportsMetrics,
  DisposalInsights,
  DisposalInsightsChartPoint,
  DisposalInsightsKpi,
  DisposalInsightsStatusSlice,
  DisposalInsightsTeamRow,
  InboundInsights,
  InsightsPeriod,
  RequirementInsights,
  SourceInsights,
  SourceInsightsRow,
  TransactionInsights,
  ViewingInsights,
  ViewingInsightsBreakdownRow,
} from '../commercial-reports.types';

export type {
  CommercialReportsMetrics,
  DisposalInsights,
  InboundInsights,
  InsightsPeriod,
  RequirementInsights,
  SourceInsights,
  TransactionInsights,
  ViewingInsights,
} from '../commercial-reports.types';

type ListingInsightRow = {
  id: string;
  status: string;
  disposal_type: string;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  on_market_at: string | null;
  created_at: string;
  assigned_to: string | null;
};

type ViewingInsightRow = {
  id: string;
  status: string;
  outcome: string | null;
  scheduled_at: string | null;
  created_at: string;
  conducted_by: string | null;
  commercial_listings?: {
    sector?: string | null;
    size_min_sqft?: number | null;
    size_max_sqft?: number | null;
  } | null;
  commercial_enquiries?: {
    source?: string | null;
  } | null;
};

const ENQUIRY_STALE_DAYS = 7;
const REQUIREMENT_STALE_DAYS = 30;

const REQUIREMENT_FUNNEL: Array<{ key: RequirementStatus; label: string }> = [
  { key: 'search', label: 'Search' },
  { key: 'viewing', label: 'Viewing' },
  { key: 'negotiating', label: 'Negs' },
  { key: 'under_offer', label: 'Under offer' },
  { key: 'success', label: 'Deal' },
];

const ACTIVE_REQUIREMENT_STAGES: RequirementStatus[] = [
  'unactioned',
  'prospect',
  'search',
  'viewing',
  'negotiating',
  'under_offer',
  'ongoing',
];

type EnquiryInsightRow = {
  id: string;
  status: string;
  source: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  target_size_min_sqft: number | null;
  target_size_max_sqft: number | null;
  commercial_listings?: {
    size_min_sqft?: number | null;
    size_max_sqft?: number | null;
  } | null;
};

type RequirementInsightRow = {
  id: string;
  stage: string;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  created_at: string;
  updated_at: string;
  source: string | null;
};

type DealInsightRow = {
  id: string;
  stage: string;
  value: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  commercial_listing_id: string | null;
  commercial_requirement_id: string | null;
  commercial_listings?: {
    size_min_sqft?: number | null;
    size_max_sqft?: number | null;
    disposal_type?: string | null;
    on_market_at?: string | null;
    created_at?: string | null;
  } | null;
  commercial_requirements?: {
    created_at?: string | null;
    source?: string | null;
    size_min_sqft?: number | null;
    size_max_sqft?: number | null;
  } | null;
};

type LeaseInsightRow = {
  id: string;
  headline_rent_psf: number | null;
  lease_start: string | null;
  lease_end: string | null;
  created_at: string;
  listing_id: string | null;
  commercial_listings?: {
    size_min_sqft?: number | null;
    size_max_sqft?: number | null;
    disposal_type?: string | null;
  } | null;
};

const SIZE_BANDS = [
  { key: '0_2.5k', label: '0 – 2.5k', min: 0, max: 2500 },
  { key: '2.5k_5k', label: '2.5k – 5k', min: 2500, max: 5000 },
  { key: '5k_10k', label: '5k – 10k', min: 5000, max: 10000 },
  { key: '10k_20k', label: '10k – 20k', min: 10000, max: 20000 },
  { key: '20k_50k', label: '20k – 50k', min: 20000, max: 50000 },
  { key: '50k_plus', label: '50k+', min: 50000, max: Infinity },
] as const;

const STATUS_GROUPS: Array<{
  key: string;
  label: string;
  statuses: ListingStatus[];
}> = [
  { key: 'draft', label: 'Not published', statuses: ['draft', 'instructed'] },
  { key: 'marketing', label: 'On market', statuses: ['marketing'] },
  { key: 'under_offer', label: 'Under offer', statuses: ['under_offer'] },
  {
    key: 'off_market',
    label: 'Off market',
    statuses: ['let', 'sold', 'withdrawn'],
  },
];

function emptyPipelineCounts(): Record<CommercialPipelineStage, number> {
  return COMMERCIAL_PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = 0;
      return acc;
    },
    {} as Record<CommercialPipelineStage, number>,
  );
}

function listingSize(row: ListingInsightRow): number | null {
  if (row.size_max_sqft != null) return Number(row.size_max_sqft);
  if (row.size_min_sqft != null) return Number(row.size_min_sqft);
  return null;
}

function viewingListingSize(row: ViewingInsightRow): number | null {
  const listing = row.commercial_listings;
  if (!listing) return null;
  if (listing.size_max_sqft != null) return Number(listing.size_max_sqft);
  if (listing.size_min_sqft != null) return Number(listing.size_min_sqft);
  return null;
}

function viewingAnchorDate(row: ViewingInsightRow): string {
  return row.scheduled_at || row.created_at;
}

function periodLabelFor(period: InsightsPeriod) {
  if (period === '7d') return 'Last 7 days';
  if (period === '30d') return 'Last 30 days';
  return 'Last quarter';
}

function accumulateBreakdown(
  map: Map<string, ViewingInsightsBreakdownRow>,
  key: string,
  label: string,
  size: number | null,
) {
  const existing = map.get(key) ?? {
    key,
    label,
    count: 0,
    totalSqft: 0,
    avgSqft: 0,
  };
  existing.count += 1;
  existing.totalSqft += size ?? 0;
  existing.avgSqft =
    existing.count > 0 ? Math.round(existing.totalSqft / existing.count) : 0;
  map.set(key, existing);
}

function resolvePeriod(period: InsightsPeriod, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (period === '7d') {
    start.setDate(start.getDate() - 7);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 30);
  } else {
    start.setMonth(start.getMonth() - 3);
  }

  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  const prevStart = new Date(start.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

function buildKpi(
  label: string,
  value: number,
  previousValue: number,
  format: DisposalInsightsKpi['format'],
): DisposalInsightsKpi {
  return { label, value, previousValue, format };
}

export function createCommercialReportsService(client: SupabaseClient) {
  return {
    async getMetrics(accountId: string): Promise<CommercialReportsMetrics> {
      const now = new Date().toISOString();

      const [
        marketingResult,
        underOfferResult,
        enquiriesResult,
        viewingsResult,
        awaitingFeedbackResult,
        marketingListingsResult,
        pipelineResult,
      ] = await Promise.all([
        client
          .from('commercial_listings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'marketing'),
        client
          .from('commercial_listings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'under_offer'),
        client
          .from('commercial_enquiries')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'unactioned'),
        client
          .from('commercial_viewings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'upcoming'),
        client
          .from('commercial_viewings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'awaiting_feedback'),
        client
          .from('commercial_listings')
          .select('on_market_at')
          .eq('account_id', accountId)
          .eq('status', 'marketing')
          .not('on_market_at', 'is', null),
        client
          .from('pipeline_deals')
          .select('stage')
          .eq('account_id', accountId)
          .in('stage', [...COMMERCIAL_PIPELINE_STAGES]),
      ]);

      for (const [label, result] of [
        ['marketing count', marketingResult],
        ['under offer count', underOfferResult],
        ['enquiries count', enquiriesResult],
        ['viewings count', viewingsResult],
        ['awaiting feedback count', awaitingFeedbackResult],
        ['days on market', marketingListingsResult],
        ['pipeline', pipelineResult],
      ] as const) {
        if (result.error) {
          console.error(`[commercial-reports] ${label}:`, result.error.message);
        }
      }

      const onMarketRows = marketingListingsResult.data ?? [];
      let avgDaysOnMarket: number | null = null;

      if (onMarketRows.length > 0) {
        const nowMs = new Date(now).getTime();
        const totalDays = onMarketRows.reduce((sum, row) => {
          const onMarketAt = row.on_market_at as string;
          const days =
            (nowMs - new Date(onMarketAt).getTime()) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0);
        avgDaysOnMarket = Math.round(totalDays / onMarketRows.length);
      }

      const pipelineByStage = emptyPipelineCounts();
      for (const row of pipelineResult.data ?? []) {
        const stage = row.stage as CommercialPipelineStage;
        if (stage in pipelineByStage) {
          pipelineByStage[stage] += 1;
        }
      }

      return {
        stockOnMarket: marketingResult.count ?? 0,
        underOffer: underOfferResult.count ?? 0,
        unactionedEnquiries: enquiriesResult.count ?? 0,
        upcomingViewings: viewingsResult.count ?? 0,
        awaitingFeedbackViewings: awaitingFeedbackResult.count ?? 0,
        avgDaysOnMarket,
        pipelineByStage,
      };
    },

    async getDisposalInsights(input: {
      accountId: string;
      period?: InsightsPeriod;
      disposalType?: 'to_let' | 'for_sale' | 'all';
    }): Promise<DisposalInsights> {
      const period = input.period ?? 'quarter';
      const disposalType = input.disposalType ?? 'to_let';
      const { start, end, prevStart, prevEnd } = resolvePeriod(period);

      let query = client
        .from('commercial_listings')
        .select(
          'id, status, disposal_type, size_min_sqft, size_max_sqft, on_market_at, created_at, assigned_to',
        )
        .eq('account_id', input.accountId);

      if (disposalType !== 'all') {
        query = query.eq('disposal_type', disposalType);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[commercial-reports] disposal insights:', error.message);
      }

      const rows = (data ?? []) as ListingInsightRow[];
      const currentCreated = rows.filter((row) =>
        inRange(row.created_at, start, end),
      );
      const previousCreated = rows.filter((row) =>
        inRange(row.created_at, prevStart, prevEnd),
      );

      const sumSize = (list: ListingInsightRow[]) =>
        list.reduce((sum, row) => sum + (listingSize(row) ?? 0), 0);
      const sized = (list: ListingInsightRow[]) =>
        list.filter((row) => listingSize(row) != null);

      const currentSized = sized(currentCreated);
      const previousSized = sized(previousCreated);
      const currentTotalSize = sumSize(currentCreated);
      const previousTotalSize = sumSize(previousCreated);
      const currentAvgSize =
        currentSized.length > 0 ? currentTotalSize / currentSized.length : 0;
      const previousAvgSize =
        previousSized.length > 0 ? previousTotalSize / previousSized.length : 0;

      const avgDom = (list: ListingInsightRow[]) => {
        const withMarket = list.filter((row) => row.on_market_at);
        if (withMarket.length === 0) return 0;
        const nowMs = end.getTime();
        const total = withMarket.reduce((sum, row) => {
          const days =
            (nowMs - new Date(row.on_market_at as string).getTime()) /
            (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0);
        return total / withMarket.length;
      };

      const marketingNow = rows.filter((row) => row.status === 'marketing');
      const marketingPrevSnapshot = rows.filter((row) => {
        if (!row.on_market_at) return false;
        const on = new Date(row.on_market_at).getTime();
        return on < prevEnd.getTime() && row.status === 'marketing';
      });

      const sizeBands: DisposalInsightsChartPoint[] = SIZE_BANDS.map((band) => {
        const countIn = (list: ListingInsightRow[]) =>
          list.filter((row) => {
            const size = listingSize(row);
            return size != null && size >= band.min && size < band.max;
          }).length;
        return {
          key: band.key,
          label: band.label,
          current: countIn(currentCreated),
          previous: countIn(previousCreated),
        };
      });

      const statusBreakdown: DisposalInsightsStatusSlice[] = STATUS_GROUPS.map(
        (group) => ({
          key: group.key,
          label: group.label,
          count: rows.filter((row) =>
            group.statuses.includes(row.status as ListingStatus),
          ).length,
        }),
      );

      const monthKeys = new Set<string>();
      for (const row of [...currentCreated, ...previousCreated]) {
        monthKeys.add(monthKey(row.created_at));
      }
      // Always show months spanning current window
      {
        const cursor = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
        );
        const endMonth = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
        );
        while (cursor <= endMonth) {
          monthKeys.add(
            `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
          );
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
      }

      const sortedMonths = [...monthKeys].sort();
      const newOverTime: DisposalInsightsChartPoint[] = sortedMonths.map(
        (key) => ({
          key,
          label: monthLabel(key),
          current: currentCreated.filter(
            (row) => monthKey(row.created_at) === key,
          ).length,
          previous: previousCreated.filter(
            (row) => monthKey(row.created_at) === key,
          ).length,
        }),
      );

      const assigneeIds = [
        ...new Set(
          rows
            .map((row) => row.assigned_to)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const nameById = new Map<string, string>();
      if (assigneeIds.length > 0) {
        const { data: accounts } = await client
          .from('accounts')
          .select('id, name')
          .in('id', assigneeIds)
          .eq('is_personal_account', true);
        for (const acc of accounts ?? []) {
          nameById.set(acc.id as string, (acc.name as string) || 'Team member');
        }
      }

      const teamMap = new Map<string, DisposalInsightsTeamRow>();
      for (const row of currentCreated) {
        const key = row.assigned_to ?? 'unassigned';
        const existing = teamMap.get(key) ?? {
          key,
          name: row.assigned_to
            ? (nameById.get(row.assigned_to) ?? 'Team member')
            : 'Unassigned',
          count: 0,
          totalSqft: 0,
        };
        existing.count += 1;
        existing.totalSqft += listingSize(row) ?? 0;
        teamMap.set(key, existing);
      }

      const periodLabel =
        period === '7d'
          ? 'Last 7 days'
          : period === '30d'
            ? 'Last 30 days'
            : 'Last quarter';

      return {
        period,
        periodLabel,
        compareEnabled: true,
        disposalType,
        kpis: {
          newInstructions: buildKpi(
            'New',
            currentCreated.length,
            previousCreated.length,
            'number',
          ),
          totalSizeSqft: buildKpi(
            'Total size ft²',
            Math.round(currentTotalSize),
            Math.round(previousTotalSize),
            'sqft',
          ),
          avgSizeSqft: buildKpi(
            'Av. size ft²',
            Math.round(currentAvgSize),
            Math.round(previousAvgSize),
            'sqft',
          ),
          avgDaysOnMarket: buildKpi(
            'Av. time on market',
            Math.round(avgDom(marketingNow) * 10) / 10,
            Math.round(avgDom(marketingPrevSnapshot) * 10) / 10,
            'days',
          ),
        },
        sizeBands,
        statusBreakdown,
        newOverTime,
        team: [...teamMap.values()].sort((a, b) => b.count - a.count),
      };
    },

    async getViewingInsights(input: {
      accountId: string;
      period?: InsightsPeriod;
    }): Promise<ViewingInsights> {
      const period = input.period ?? 'quarter';
      const { start, end, prevStart, prevEnd } = resolvePeriod(period);

      const { data, error } = await client
        .from('commercial_viewings')
        .select(
          'id, status, outcome, scheduled_at, created_at, conducted_by, commercial_listings(sector, size_min_sqft, size_max_sqft), commercial_enquiries(source)',
        )
        .eq('account_id', input.accountId);

      if (error) {
        console.error('[commercial-reports] viewing insights:', error.message);
      }

      const rows = (data ?? []) as ViewingInsightRow[];
      const current = rows.filter((row) =>
        inRange(viewingAnchorDate(row), start, end),
      );
      const previous = rows.filter((row) =>
        inRange(viewingAnchorDate(row), prevStart, prevEnd),
      );

      const countOutcome = (
        list: ViewingInsightRow[],
        outcome: ViewingOutcome,
      ) => list.filter((row) => row.outcome === outcome).length;
      const countStatus = (list: ViewingInsightRow[], status: string) =>
        list.filter((row) => row.status === status).length;

      const agentIds = [
        ...new Set(
          current
            .map((row) => row.conducted_by)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const nameById = new Map<string, string>();
      if (agentIds.length > 0) {
        const { data: accounts } = await client
          .from('accounts')
          .select('id, name')
          .in('id', agentIds)
          .eq('is_personal_account', true);
        for (const acc of accounts ?? []) {
          nameById.set(acc.id as string, (acc.name as string) || 'Team member');
        }
      }

      const sectorMap = new Map<string, ViewingInsightsBreakdownRow>();
      const sourceMap = new Map<string, ViewingInsightsBreakdownRow>();
      const agentMap = new Map<string, ViewingInsightsBreakdownRow>();

      for (const row of current) {
        const size = viewingListingSize(row);
        const sector = row.commercial_listings?.sector?.trim() || 'Unknown';
        accumulateBreakdown(sectorMap, sector.toLowerCase(), sector, size);

        const sourceRaw = row.commercial_enquiries?.source?.trim() || 'unknown';
        const sourceLabel =
          sourceRaw in ENQUIRY_SOURCE_LABELS
            ? ENQUIRY_SOURCE_LABELS[sourceRaw as EnquirySource]
            : sourceRaw === 'unknown'
              ? 'Unknown'
              : sourceRaw;
        accumulateBreakdown(sourceMap, sourceRaw, sourceLabel, size);

        const agentKey = row.conducted_by ?? 'unassigned';
        const agentLabel = row.conducted_by
          ? (nameById.get(row.conducted_by) ?? 'Team member')
          : 'Unassigned';
        accumulateBreakdown(agentMap, agentKey, agentLabel, size);
      }

      const monthKeys = new Set<string>();
      for (const row of [...current, ...previous]) {
        monthKeys.add(monthKey(viewingAnchorDate(row)));
      }
      {
        const cursor = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
        );
        const endMonth = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
        );
        while (cursor <= endMonth) {
          monthKeys.add(monthKey(cursor.toISOString()));
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
      }

      const overTime: DisposalInsightsChartPoint[] = [...monthKeys]
        .sort()
        .map((key) => ({
          key,
          label: monthLabel(key),
          current: current.filter(
            (row) => monthKey(viewingAnchorDate(row)) === key,
          ).length,
          previous: previous.filter(
            (row) => monthKey(viewingAnchorDate(row)) === key,
          ).length,
        }));

      return {
        period,
        periodLabel: periodLabelFor(period),
        kpis: {
          total: buildKpi(
            'Total viewings',
            current.length,
            previous.length,
            'number',
          ),
          positive: buildKpi(
            'Positive',
            countOutcome(current, 'positive'),
            countOutcome(previous, 'positive'),
            'number',
          ),
          neutral: buildKpi(
            'Neutral',
            countOutcome(current, 'neutral'),
            countOutcome(previous, 'neutral'),
            'number',
          ),
          negative: buildKpi(
            'Negative',
            countOutcome(current, 'negative'),
            countOutcome(previous, 'negative'),
            'number',
          ),
          awaitingFeedback: buildKpi(
            'Awaiting feedback',
            countStatus(current, 'awaiting_feedback'),
            countStatus(previous, 'awaiting_feedback'),
            'number',
          ),
          cancelled: buildKpi(
            'Cancelled',
            countStatus(current, 'cancelled'),
            countStatus(previous, 'cancelled'),
            'number',
          ),
        },
        bySector: [...sectorMap.values()].sort((a, b) => b.count - a.count),
        bySource: [...sourceMap.values()].sort((a, b) => b.count - a.count),
        byAgent: [...agentMap.values()].sort((a, b) => b.count - a.count),
        overTime,
      };
    },

    async getInboundInsights(input: {
      accountId: string;
      period?: InsightsPeriod;
    }): Promise<InboundInsights> {
      const period = input.period ?? 'quarter';
      const { start, end, prevStart, prevEnd } = resolvePeriod(period);
      const now = end;

      const { data, error } = await client
        .from('commercial_enquiries')
        .select(
          'id, status, source, received_at, created_at, updated_at, target_size_min_sqft, target_size_max_sqft',
        )
        .eq('account_id', input.accountId);

      if (error) {
        console.error('[commercial-reports] inbound insights:', error.message);
      }

      const rows = (data ?? []) as EnquiryInsightRow[];
      const receivedIn = (from: Date, to: Date) =>
        rows.filter((row) =>
          inRange(row.received_at || row.created_at, from, to),
        );

      const current = receivedIn(start, end);
      const previous = receivedIn(prevStart, prevEnd);

      const countStatus = (list: EnquiryInsightRow[], status: string) =>
        list.filter((row) => row.status === status).length;

      const actionedDays = (list: EnquiryInsightRow[]) => {
        const actioned = list.filter((row) => row.status !== 'unactioned');
        if (actioned.length === 0) return 0;
        const total = actioned.reduce((sum, row) => {
          const startMs = new Date(row.received_at || row.created_at).getTime();
          const endMs = new Date(row.updated_at).getTime();
          return sum + Math.max(0, (endMs - startMs) / (1000 * 60 * 60 * 24));
        }, 0);
        return total / actioned.length;
      };

      const stalePercent = (list: EnquiryInsightRow[]) => {
        const unactioned = list.filter((row) => row.status === 'unactioned');
        if (unactioned.length === 0) return 0;
        const stale = unactioned.filter((row) => {
          const age =
            (now.getTime() -
              new Date(row.received_at || row.created_at).getTime()) /
            (1000 * 60 * 60 * 24);
          return age >= ENQUIRY_STALE_DAYS;
        }).length;
        return (stale / unactioned.length) * 100;
      };

      // Snapshot-style unactioned / actioned across all open stock (not only period new)
      const allUnactioned = rows.filter((row) => row.status === 'unactioned');
      const allActioned = rows.filter((row) => row.status === 'on_schedule');
      const prevUnactionedApprox = previous.filter(
        (row) => row.status === 'unactioned',
      ).length;
      const prevActionedApprox = previous.filter(
        (row) => row.status === 'on_schedule',
      ).length;

      const byStatus: DisposalInsightsStatusSlice[] = [
        {
          key: 'unactioned',
          label: 'Unactioned',
          count: countStatus(current, 'unactioned'),
        },
        {
          key: 'on_schedule',
          label: 'On schedule',
          count: countStatus(current, 'on_schedule'),
        },
        {
          key: 'archived',
          label: 'Archived',
          count: countStatus(current, 'archived'),
        },
      ];

      const monthKeys = new Set<string>();
      for (const row of [...current, ...previous]) {
        monthKeys.add(monthKey(row.received_at || row.created_at));
      }
      {
        const cursor = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
        );
        const endMonth = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
        );
        while (cursor <= endMonth) {
          monthKeys.add(monthKey(cursor.toISOString()));
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
      }

      const overTime: DisposalInsightsChartPoint[] = [...monthKeys]
        .sort()
        .map((key) => ({
          key,
          label: monthLabel(key),
          current: current.filter(
            (row) => monthKey(row.received_at || row.created_at) === key,
          ).length,
          previous: previous.filter(
            (row) => monthKey(row.received_at || row.created_at) === key,
          ).length,
        }));

      return {
        period,
        periodLabel: periodLabelFor(period),
        kpis: {
          newEnquiries: buildKpi(
            'New enquiries',
            current.length,
            previous.length,
            'number',
          ),
          unactioned: buildKpi(
            'Unactioned',
            allUnactioned.length,
            prevUnactionedApprox,
            'number',
          ),
          actioned: buildKpi(
            'Actioned',
            allActioned.length,
            prevActionedApprox,
            'number',
          ),
          avgDaysToAction: buildKpi(
            'Av. days to action',
            Math.round(actionedDays(current) * 10) / 10,
            Math.round(actionedDays(previous) * 10) / 10,
            'days',
          ),
          archived: buildKpi(
            'Archived',
            countStatus(current, 'archived'),
            countStatus(previous, 'archived'),
            'number',
          ),
          stalePercent: buildKpi(
            'Stale %',
            Math.round(stalePercent(allUnactioned) * 10) / 10,
            Math.round(
              stalePercent(previous.filter((r) => r.status === 'unactioned')) *
                10,
            ) / 10,
            'percent',
          ),
        },
        byStatus,
        overTime,
      };
    },

    async getRequirementInsights(input: {
      accountId: string;
      period?: InsightsPeriod;
    }): Promise<RequirementInsights> {
      const period = input.period ?? 'quarter';
      const { start, end } = resolvePeriod(period);
      const now = end;

      const { data, error } = await client
        .from('commercial_requirements')
        .select(
          'id, stage, size_min_sqft, size_max_sqft, created_at, updated_at, source',
        )
        .eq('account_id', input.accountId);

      if (error) {
        console.error(
          '[commercial-reports] requirement insights:',
          error.message,
        );
      }

      const rows = (data ?? []) as RequirementInsightRow[];
      const ageDays = (iso: string) =>
        Math.max(
          0,
          (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
        );

      const active = rows.filter((row) =>
        ACTIVE_REQUIREMENT_STAGES.includes(row.stage as RequirementStatus),
      );
      const onHold = rows.filter((row) => row.stage === 'on_hold');
      const archived = rows.filter((row) => row.stage === 'unsuccessful');
      const signed = rows.filter((row) => row.stage === 'success');
      const createdCurrent = rows.filter((row) =>
        inRange(row.created_at, start, end),
      );

      const avgAge =
        active.length > 0
          ? active.reduce((sum, row) => sum + ageDays(row.created_at), 0) /
            active.length
          : 0;

      const stale = active.filter((row) => {
        const idle = ageDays(row.updated_at);
        return idle >= REQUIREMENT_STALE_DAYS;
      });

      const byStage: DisposalInsightsStatusSlice[] = Object.entries(
        REQUIREMENT_STATUS_LABELS,
      ).map(([key, label]) => ({
        key,
        label,
        count: rows.filter((row) => row.stage === key).length,
      }));

      const qualification: DisposalInsightsStatusSlice[] = [
        {
          key: 'unactioned',
          label: 'Unactioned',
          count: rows.filter((row) => row.stage === 'unactioned').length,
        },
        {
          key: 'qualified',
          label: 'Qualified',
          count: rows.filter(
            (row) =>
              row.stage !== 'unactioned' &&
              row.stage !== 'unsuccessful' &&
              row.stage !== 'success',
          ).length,
        },
        {
          key: 'disqualified',
          label: 'Disqualified',
          count: archived.length,
        },
      ];

      const funnel = REQUIREMENT_FUNNEL.map((step) => ({
        key: step.key,
        label: step.label,
        count: rows.filter((row) => row.stage === step.key).length,
      }));

      const funnelStart = funnel[0]?.count ?? 0;
      const funnelEnd = funnel[funnel.length - 1]?.count ?? 0;
      const conversionRate =
        funnelStart > 0 ? (funnelEnd / funnelStart) * 100 : 0;

      return {
        period,
        periodLabel: periodLabelFor(period),
        kpis: {
          active: buildKpi(
            'Active',
            active.length,
            createdCurrent.length,
            'number',
          ),
          onHold: buildKpi('On hold', onHold.length, 0, 'number'),
          archived: buildKpi('Archived', archived.length, 0, 'number'),
          signed: buildKpi('Signed', signed.length, 0, 'number'),
          avgAgeDays: buildKpi(
            'Av. age',
            Math.round(avgAge * 10) / 10,
            0,
            'days',
          ),
          stale: buildKpi('Stale', stale.length, 0, 'number'),
        },
        byStage,
        qualification,
        funnel,
        conversionRate: Math.round(conversionRate * 10) / 10,
      };
    },

    async getSourceInsights(input: {
      accountId: string;
      period?: InsightsPeriod;
    }): Promise<SourceInsights> {
      const period = input.period ?? 'quarter';
      const { start, end, prevStart, prevEnd } = resolvePeriod(period);

      const { data, error } = await client
        .from('commercial_enquiries')
        .select(
          'id, status, source, received_at, created_at, updated_at, target_size_min_sqft, target_size_max_sqft, commercial_listings(size_min_sqft, size_max_sqft)',
        )
        .eq('account_id', input.accountId);

      if (error) {
        console.error('[commercial-reports] source insights:', error.message);
      }

      const rows = (data ?? []) as EnquiryInsightRow[];
      const inPeriod = (from: Date, to: Date) =>
        rows.filter((row) =>
          inRange(row.received_at || row.created_at, from, to),
        );

      const current = inPeriod(start, end);
      const previous = inPeriod(prevStart, prevEnd);

      const enquiryVolume = (row: EnquiryInsightRow) => {
        if (row.target_size_max_sqft != null)
          return Number(row.target_size_max_sqft);
        if (row.target_size_min_sqft != null)
          return Number(row.target_size_min_sqft);
        const listing = row.commercial_listings;
        if (listing?.size_max_sqft != null)
          return Number(listing.size_max_sqft);
        if (listing?.size_min_sqft != null)
          return Number(listing.size_min_sqft);
        return 0;
      };

      const sourceKeys = new Set<string>();
      for (const row of [...current, ...previous]) {
        sourceKeys.add(row.source?.trim() || 'unknown');
      }

      const rowsOut: SourceInsightsRow[] = [...sourceKeys]
        .map((key) => {
          const label =
            key in ENQUIRY_SOURCE_LABELS
              ? ENQUIRY_SOURCE_LABELS[key as EnquirySource]
              : key === 'unknown'
                ? 'Unknown'
                : key;
          const cur = current.filter(
            (row) => (row.source?.trim() || 'unknown') === key,
          );
          const prev = previous.filter(
            (row) => (row.source?.trim() || 'unknown') === key,
          );
          return {
            key,
            label,
            leadCount: cur.length,
            previousLeadCount: prev.length,
            volumeSqft: Math.round(
              cur.reduce((s, r) => s + enquiryVolume(r), 0),
            ),
            previousVolumeSqft: Math.round(
              prev.reduce((s, r) => s + enquiryVolume(r), 0),
            ),
          };
        })
        .sort((a, b) => b.leadCount - a.leadCount);

      const totalLeads = current.length;
      const prevLeads = previous.length;
      const totalVol = rowsOut.reduce((s, r) => s + r.volumeSqft, 0);
      const prevVol = rowsOut.reduce((s, r) => s + r.previousVolumeSqft, 0);

      return {
        period,
        periodLabel: periodLabelFor(period),
        rows: rowsOut,
        totalLeads: buildKpi('Leads', totalLeads, prevLeads, 'number'),
        totalVolumeSqft: buildKpi('Volume ft²', totalVol, prevVol, 'sqft'),
      };
    },

    async getTransactionInsights(input: {
      accountId: string;
      period?: InsightsPeriod;
      kind?: 'lettings' | 'sales';
    }): Promise<TransactionInsights> {
      const period = input.period ?? 'quarter';
      const kind = input.kind ?? 'lettings';
      const { start, end, prevStart, prevEnd } = resolvePeriod(period);

      const [dealsResult, leasesResult] = await Promise.all([
        client
          .from('pipeline_deals')
          .select(
            'id, stage, value, created_at, updated_at, completed_at, commercial_listing_id, commercial_requirement_id, commercial_listings(size_min_sqft, size_max_sqft, disposal_type, on_market_at, created_at), commercial_requirements(created_at, source, size_min_sqft, size_max_sqft)',
          )
          .eq('account_id', input.accountId)
          .eq('stage', 'completed_exchanged'),
        client
          .from('commercial_leases')
          .select(
            'id, headline_rent_psf, lease_start, lease_end, created_at, listing_id, commercial_listings(size_min_sqft, size_max_sqft, disposal_type)',
          )
          .eq('account_id', input.accountId),
      ]);

      if (dealsResult.error) {
        console.error(
          '[commercial-reports] transaction deals:',
          dealsResult.error.message,
        );
      }
      if (leasesResult.error) {
        console.error(
          '[commercial-reports] transaction leases:',
          leasesResult.error.message,
        );
      }

      const deals = (dealsResult.data ?? []) as DealInsightRow[];
      const leases = (leasesResult.data ?? []) as LeaseInsightRow[];

      const matchesKind = (disposalType: string | null | undefined) => {
        if (kind === 'sales') {
          return disposalType === 'for_sale' || disposalType === 'investment';
        }
        return !disposalType || disposalType === 'to_let';
      };

      const dealsIn = (from: Date, to: Date) =>
        deals.filter((row) => {
          const anchor = row.completed_at || row.updated_at || row.created_at;
          return (
            inRange(anchor, from, to) &&
            matchesKind(row.commercial_listings?.disposal_type)
          );
        });

      const leasesIn = (from: Date, to: Date) =>
        leases.filter((row) => {
          const anchor = row.lease_start || row.created_at;
          return (
            inRange(anchor, from, to) &&
            matchesKind(row.commercial_listings?.disposal_type)
          );
        });

      const currentDeals = dealsIn(start, end);
      const previousDeals = dealsIn(prevStart, prevEnd);
      const currentLeases = leasesIn(start, end);
      const previousLeases = leasesIn(prevStart, prevEnd);

      const dealSize = (row: DealInsightRow) => {
        const listing = row.commercial_listings;
        if (listing?.size_max_sqft != null)
          return Number(listing.size_max_sqft);
        if (listing?.size_min_sqft != null)
          return Number(listing.size_min_sqft);
        const req = row.commercial_requirements;
        if (req?.size_max_sqft != null) return Number(req.size_max_sqft);
        if (req?.size_min_sqft != null) return Number(req.size_min_sqft);
        return null;
      };

      const leaseSize = (row: LeaseInsightRow) => {
        const listing = row.commercial_listings;
        if (listing?.size_max_sqft != null)
          return Number(listing.size_max_sqft);
        if (listing?.size_min_sqft != null)
          return Number(listing.size_min_sqft);
        return null;
      };

      const leaseYears = (row: LeaseInsightRow) => {
        if (!row.lease_start || !row.lease_end) return null;
        const ms =
          new Date(row.lease_end).getTime() -
          new Date(row.lease_start).getTime();
        return Math.max(0, ms / (1000 * 60 * 60 * 24 * 365.25));
      };

      const avg = (values: number[]) =>
        values.length > 0
          ? values.reduce((s, v) => s + v, 0) / values.length
          : 0;

      const currentSizes = [
        ...currentDeals.map(dealSize),
        ...currentLeases.map(leaseSize),
      ].filter((v): v is number => v != null);
      const previousSizes = [
        ...previousDeals.map(dealSize),
        ...previousLeases.map(leaseSize),
      ].filter((v): v is number => v != null);

      const currentRents = currentLeases
        .map((row) =>
          row.headline_rent_psf != null ? Number(row.headline_rent_psf) : null,
        )
        .filter((v): v is number => v != null);
      const previousRents = previousLeases
        .map((row) =>
          row.headline_rent_psf != null ? Number(row.headline_rent_psf) : null,
        )
        .filter((v): v is number => v != null);

      const currentLeaseYears = currentLeases
        .map(leaseYears)
        .filter((v): v is number => v != null);
      const previousLeaseYears = previousLeases
        .map(leaseYears)
        .filter((v): v is number => v != null);

      const disposalDays = (row: DealInsightRow) => {
        const listingStart =
          row.commercial_listings?.on_market_at ||
          row.commercial_listings?.created_at;
        if (!listingStart) return null;
        const close = new Date(
          row.completed_at || row.updated_at || row.created_at,
        ).getTime();
        return Math.max(
          0,
          (close - new Date(listingStart).getTime()) / (1000 * 60 * 60 * 24),
        );
      };

      const requirementDays = (row: DealInsightRow) => {
        const reqStart = row.commercial_requirements?.created_at;
        if (!reqStart) return null;
        const close = new Date(
          row.completed_at || row.updated_at || row.created_at,
        ).getTime();
        return Math.max(
          0,
          (close - new Date(reqStart).getTime()) / (1000 * 60 * 60 * 24),
        );
      };

      const currentDisposalDays = currentDeals
        .map(disposalDays)
        .filter((v): v is number => v != null);
      const previousDisposalDays = previousDeals
        .map(disposalDays)
        .filter((v): v is number => v != null);
      const currentReqDays = currentDeals
        .map(requirementDays)
        .filter((v): v is number => v != null);
      const previousReqDays = previousDeals
        .map(requirementDays)
        .filter((v): v is number => v != null);

      const totalCurrent = currentDeals.length + currentLeases.length;
      const totalPrevious = previousDeals.length + previousLeases.length;

      const sourceMap = new Map<string, ViewingInsightsBreakdownRow>();
      for (const row of currentDeals) {
        const sourceRaw =
          row.commercial_requirements?.source?.trim() || 'unknown';
        const label =
          sourceRaw in ENQUIRY_SOURCE_LABELS
            ? ENQUIRY_SOURCE_LABELS[sourceRaw as EnquirySource]
            : sourceRaw === 'unknown'
              ? 'Unknown'
              : sourceRaw;
        accumulateBreakdown(sourceMap, sourceRaw, label, dealSize(row));
      }

      return {
        period,
        periodLabel: periodLabelFor(period),
        kind,
        kpis: {
          totalDeals: buildKpi(
            'Total deals',
            totalCurrent,
            totalPrevious,
            'number',
          ),
          avgSizeSqft: buildKpi(
            'Av. size ft²',
            Math.round(avg(currentSizes)),
            Math.round(avg(previousSizes)),
            'sqft',
          ),
          avgRentPsf: buildKpi(
            'Av. rent ft²',
            Math.round(avg(currentRents) * 100) / 100,
            Math.round(avg(previousRents) * 100) / 100,
            'number',
          ),
          avgLeaseYears: buildKpi(
            'Av. lease length',
            Math.round(avg(currentLeaseYears) * 10) / 10,
            Math.round(avg(previousLeaseYears) * 10) / 10,
            'number',
          ),
          avgDisposalDaysToClose: buildKpi(
            'Av. disposal days',
            Math.round(avg(currentDisposalDays) * 10) / 10,
            Math.round(avg(previousDisposalDays) * 10) / 10,
            'days',
          ),
          avgRequirementDaysToClose: buildKpi(
            'Av. requirement days',
            Math.round(avg(currentReqDays) * 10) / 10,
            Math.round(avg(previousReqDays) * 10) / 10,
            'days',
          ),
        },
        bySource: [...sourceMap.values()].sort((a, b) => b.count - a.count),
      };
    },
  };
}
