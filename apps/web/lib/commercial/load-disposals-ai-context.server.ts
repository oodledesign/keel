import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { looseClient } from '~/lib/retainers/loose-client';

import {
  DISPOSALS_AI_HISTORY_EVENT_TYPES,
  DISPOSALS_AI_LISTING_COLUMNS,
  type DisposalsAiEvent,
  type DisposalsAiFacts,
  type DisposalsAiPeriod,
  buildDisposalsAiFacts,
} from './disposals-ai-facts';
import { filterScheduleListingsForUser } from './disposals-schedule';
import { fetchAllPages } from './load-disposals-schedule.server';

/**
 * Load access-filtered disposals and their status events for the requested
 * period(s), then reduce them to public-safe facts. Uses the caller's
 * RLS-scoped client; restricted disposals follow the schedule export rules.
 */
export async function loadDisposalsAiFacts(params: {
  client: SupabaseClient;
  accountId: string;
  userId: string;
  canSeeRestricted: boolean;
  period: DisposalsAiPeriod;
  comparison: DisposalsAiPeriod | null;
  now: Date;
}): Promise<DisposalsAiFacts> {
  const { accountId } = params;
  const db = looseClient(params.client);

  const periods = [params.period, params.comparison].filter(
    (period): period is DisposalsAiPeriod => Boolean(period),
  );
  const [allListings, agents, eventPages, firstEvent] = await Promise.all([
    fetchAllPages(() =>
      db
        .from('commercial_listings')
        .select(DISPOSALS_AI_LISTING_COLUMNS)
        .eq('account_id', accountId)
        .order('id'),
    ),
    fetchAllPages(() =>
      db
        .from('commercial_listing_agents')
        .select('listing_id, user_id')
        .eq('account_id', accountId)
        .order('id'),
    ),
    Promise.all(
      periods.map((period) =>
        fetchAllPages(() =>
          db
            .from('commercial_listing_events')
            .select('id, listing_id, event_type, metadata, created_at')
            .eq('account_id', accountId)
            .in('event_type', DISPOSALS_AI_HISTORY_EVENT_TYPES)
            .gte('created_at', period.from)
            .lt('created_at', period.to)
            .order('id'),
        ),
      ),
    ),
    db
      .from('commercial_listing_events')
      .select('created_at')
      .eq('account_id', accountId)
      .in('event_type', DISPOSALS_AI_HISTORY_EVENT_TYPES)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (firstEvent.error) throw new Error(firstEvent.error.message);

  const listings = filterScheduleListingsForUser({
    listings: allListings,
    agents,
    userId: params.userId,
    canSeeRestricted: params.canSeeRestricted,
  });

  const eventRows = new Map<string, Record<string, unknown>>();
  for (const row of eventPages.flat()) eventRows.set(String(row.id), row);

  const events: DisposalsAiEvent[] = [...eventRows.values()].map((row) => ({
    listingId: String(row.listing_id),
    eventType: String(row.event_type),
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
  }));

  const historyStart =
    typeof firstEvent.data?.created_at === 'string'
      ? firstEvent.data.created_at
      : null;

  return buildDisposalsAiFacts({
    listings,
    events,
    period: params.period,
    comparison: params.comparison,
    historyStart,
    now: params.now,
  });
}
