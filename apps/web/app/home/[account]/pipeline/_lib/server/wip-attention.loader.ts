import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createMatchSuggestionsService } from '~/home/[account]/listings/_lib/server/match-suggestions.service';
import {
  ACTIVE_REQUIREMENT_STAGES_FOR_MATCH,
  DEFAULT_MATCH_SUGGESTION_MIN_SCORE,
} from '~/lib/commercial/match-scoring';
import { isCommercialTerminalStage } from '~/lib/commercial/pipeline-stage-config';

export type WipAttentionKind =
  | 'action_overdue'
  | 'instruction_idle'
  | 'enquiry_unactioned'
  | 'viewing_feedback'
  | 'requirement_stale'
  | 'interest_stuck'
  | 'match_opportunities';

export type WipAttentionItem = {
  id: string;
  kind: WipAttentionKind;
  title: string;
  subtitle: string | null;
  /** Path relative to account home, e.g. `/pipeline?view=instructions` */
  path: string;
  daysAgo: number | null;
};

export type WipAttentionBucket = {
  kind: WipAttentionKind;
  label: string;
  count: number;
  items: WipAttentionItem[];
};

export type WipAttentionDigest = {
  total: number;
  buckets: WipAttentionBucket[];
};

const IDLE_INSTRUCTION_DAYS = 14;
const STALE_REQUIREMENT_DAYS = 21;
const INTEREST_STUCK_DAYS = 7;
const ITEM_LIMIT = 5;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dealTitle(row: Record<string, unknown>): string {
  const name = String(row.name ?? '').trim();
  const company = String(row.company_name ?? '').trim();
  const contact = String(row.contact_name ?? '').trim();
  return name || company || contact || 'Instruction';
}

export async function loadWipAttentionDigest(
  client: SupabaseClient,
  accountId: string,
): Promise<WipAttentionDigest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const idleCutoff = cutoffIso(IDLE_INSTRUCTION_DAYS);
  const staleReqCutoff = cutoffIso(STALE_REQUIREMENT_DAYS);
  const interestCutoff = cutoffIso(INTEREST_STUCK_DAYS);
  const today = todayIsoDate();

  const [
    dealsResult,
    enquiriesResult,
    viewingsResult,
    requirementsResult,
    matchesResult,
    matchDigest,
  ] = await Promise.all([
    db
      .from('pipeline_deals')
      .select(
        'id, name, company_name, contact_name, stage, next_action, next_action_date, updated_at, commercial_listing_id',
      )
      .eq('account_id', accountId)
      .order('updated_at', { ascending: true })
      .limit(200),
    db
      .from('commercial_enquiries')
      .select(
        'id, listing_id, contact_name, contact_email, message, received_at, status, commercial_listings(name)',
      )
      .eq('account_id', accountId)
      .eq('status', 'unactioned')
      .order('received_at', { ascending: true })
      .limit(40),
    db
      .from('commercial_viewings')
      .select(
        'id, listing_id, scheduled_at, status, updated_at, commercial_listings(name)',
      )
      .eq('account_id', accountId)
      .eq('status', 'awaiting_feedback')
      .order('scheduled_at', { ascending: true })
      .limit(40),
    db
      .from('commercial_requirements')
      .select(
        'id, company_name, contact_name, sector, location_text, stage, updated_at',
      )
      .eq('account_id', accountId)
      .in('stage', [...ACTIVE_REQUIREMENT_STAGES_FOR_MATCH])
      .lt('updated_at', staleReqCutoff)
      .order('updated_at', { ascending: true })
      .limit(40),
    db
      .from('commercial_matches')
      .select(
        'id, listing_id, requirement_id, status, last_activity_at, commercial_listings(name), commercial_requirements(company_name, contact_name)',
      )
      .eq('account_id', accountId)
      .in('status', ['new', 'viewing_arranged'])
      .lt('last_activity_at', interestCutoff)
      .order('last_activity_at', { ascending: true })
      .limit(40),
    createMatchSuggestionsService(client).deskDigest({
      accountId,
      limit: 5,
      minScore: DEFAULT_MATCH_SUGGESTION_MIN_SCORE,
      requirementDays: 45,
    }),
  ]);

  for (const [label, result] of [
    ['deals', dealsResult],
    ['enquiries', enquiriesResult],
    ['viewings', viewingsResult],
    ['requirements', requirementsResult],
    ['matches', matchesResult],
  ] as const) {
    if (result.error) {
      console.error(`[wip-attention] ${label}:`, result.error.message);
    }
  }

  const deals = (dealsResult.data ?? []) as Array<Record<string, unknown>>;
  const activeDeals = deals.filter(
    (row) => !isCommercialTerminalStage(String(row.stage ?? '')),
  );

  const overdueItems: WipAttentionItem[] = activeDeals
    .filter((row) => {
      const d = row.next_action_date as string | null;
      return Boolean(d && d.slice(0, 10) < today);
    })
    .map((row) => ({
      id: String(row.id),
      kind: 'action_overdue' as const,
      title: dealTitle(row),
      subtitle: String(row.next_action ?? '').trim() || 'Next action overdue',
      path: '/pipeline?view=instructions',
      daysAgo: daysSince(String(row.next_action_date)),
    }))
    .slice(0, ITEM_LIMIT);

  const idleItems: WipAttentionItem[] = activeDeals
    .filter((row) => {
      const updated = String(row.updated_at ?? '');
      return updated && updated < idleCutoff;
    })
    .map((row) => ({
      id: String(row.id),
      kind: 'instruction_idle' as const,
      title: dealTitle(row),
      subtitle: `No movement for ${daysSince(String(row.updated_at)) ?? IDLE_INSTRUCTION_DAYS}+ days`,
      path: row.commercial_listing_id
        ? `/listings/${row.commercial_listing_id}`
        : '/pipeline?view=instructions',
      daysAgo: daysSince(String(row.updated_at)),
    }))
    .slice(0, ITEM_LIMIT);

  const enquiryItems: WipAttentionItem[] = (
    (enquiriesResult.data ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => {
      const listing = row.commercial_listings as {
        name?: string | null;
      } | null;
      return {
        id: String(row.id),
        kind: 'enquiry_unactioned' as const,
        title:
          String(row.contact_name ?? '').trim() ||
          String(row.contact_email ?? '').trim() ||
          'Enquiry',
        subtitle: listing?.name
          ? `On ${listing.name}`
          : String(row.message ?? '')
              .trim()
              .slice(0, 80) || null,
        path: row.listing_id ? `/listings/${row.listing_id}` : '/listings',
        daysAgo: daysSince(String(row.received_at ?? '')),
      };
    })
    .slice(0, ITEM_LIMIT);

  const viewingItems: WipAttentionItem[] = (
    (viewingsResult.data ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => {
      const listing = row.commercial_listings as {
        name?: string | null;
      } | null;
      return {
        id: String(row.id),
        kind: 'viewing_feedback' as const,
        title: listing?.name?.trim() || 'Viewing',
        subtitle: 'Awaiting feedback',
        path: '/viewings',
        daysAgo: daysSince(String(row.scheduled_at ?? row.updated_at ?? '')),
      };
    })
    .slice(0, ITEM_LIMIT);

  const requirementItems: WipAttentionItem[] = (
    (requirementsResult.data ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => ({
      id: String(row.id),
      kind: 'requirement_stale' as const,
      title:
        String(row.company_name ?? '').trim() ||
        String(row.contact_name ?? '').trim() ||
        'Requirement',
      subtitle:
        [row.sector, row.location_text]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .join(' · ') || 'No recent activity',
      path: '/pipeline?view=requirements',
      daysAgo: daysSince(String(row.updated_at ?? '')),
    }))
    .slice(0, ITEM_LIMIT);

  const interestItems: WipAttentionItem[] = (
    (matchesResult.data ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => {
      const listing = row.commercial_listings as {
        name?: string | null;
      } | null;
      const requirement = row.commercial_requirements as {
        company_name?: string | null;
        contact_name?: string | null;
      } | null;
      const reqLabel =
        requirement?.company_name?.trim() ||
        requirement?.contact_name?.trim() ||
        'Requirement';
      return {
        id: String(row.id),
        kind: 'interest_stuck' as const,
        title: `${reqLabel} → ${listing?.name?.trim() || 'Disposal'}`,
        subtitle: `Interest still “${String(row.status)}”`,
        path: row.listing_id
          ? `/listings/${row.listing_id}`
          : '/pipeline?view=requirements',
        daysAgo: daysSince(String(row.last_activity_at ?? '')),
      };
    })
    .slice(0, ITEM_LIMIT);

  const matchItems: WipAttentionItem[] = matchDigest.suggestions.map((s) => ({
    id: `${s.listingId}:${s.requirementId}`,
    kind: 'match_opportunities' as const,
    title: `${s.requirementLabel} → ${s.listingName}`,
    subtitle: s.reasons.slice(0, 2).join(' · ') || `${s.score}% fit`,
    path: `/listings/${s.listingId}`,
    daysAgo: null,
  }));

  const overdueCount = activeDeals.filter((row) => {
    const d = row.next_action_date as string | null;
    return Boolean(d && d.slice(0, 10) < today);
  }).length;
  const idleCount = activeDeals.filter((row) => {
    const updated = String(row.updated_at ?? '');
    return updated && updated < idleCutoff;
  }).length;

  const allBuckets: WipAttentionBucket[] = [
    {
      kind: 'action_overdue',
      label: 'Overdue actions',
      count: overdueCount,
      items: overdueItems,
    },
    {
      kind: 'instruction_idle',
      label: 'Idle instructions',
      count: idleCount,
      items: idleItems,
    },
    {
      kind: 'enquiry_unactioned',
      label: 'Unactioned enquiries',
      count: (enquiriesResult.data ?? []).length,
      items: enquiryItems,
    },
    {
      kind: 'viewing_feedback',
      label: 'Awaiting feedback',
      count: (viewingsResult.data ?? []).length,
      items: viewingItems,
    },
    {
      kind: 'requirement_stale',
      label: 'Stale requirements',
      count: (requirementsResult.data ?? []).length,
      items: requirementItems,
    },
    {
      kind: 'interest_stuck',
      label: 'Stuck interest',
      count: (matchesResult.data ?? []).length,
      items: interestItems,
    },
    {
      kind: 'match_opportunities',
      label: 'Match opportunities',
      count: matchDigest.count,
      items: matchItems,
    },
  ];

  const buckets = allBuckets.filter((b) => b.count > 0);

  return {
    total: buckets.reduce((sum, b) => sum + b.count, 0),
    buckets,
  };
}
