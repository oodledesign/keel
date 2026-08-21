import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { recordCommercialAccountEvent } from '~/lib/commercial/account-events';

/** Tables not yet in generated Database types — unwrap until typegen. */
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export type ListingEventType =
  | 'status_changed'
  | 'listing_created'
  | 'match_added'
  | 'match_updated'
  | 'viewing_created'
  | 'viewing_updated'
  | 'enquiry_created'
  | 'portal_sync'
  | 'media_changed'
  | 'marketing_updated'
  | 'note'
  | 'seeded';

export type CommercialListingEvent = {
  id: string;
  accountId: string;
  listingId: string;
  actorUserId: string | null;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName?: string | null;
  actorPictureUrl?: string | null;
};

export type RecordListingEventInput = {
  accountId: string;
  listingId: string;
  eventType: ListingEventType | string;
  summary: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  /** Override created_at (used when seeding historical rows). */
  createdAt?: string;
};

type EventRow = {
  id: string;
  account_id: string;
  listing_id: string;
  actor_user_id: string | null;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function mapListingEvent(row: EventRow): CommercialListingEvent {
  return {
    id: row.id,
    accountId: row.account_id,
    listingId: row.listing_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    summary: row.summary,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

/**
 * Best-effort activity insert. Never throws — callers should not fail main ops.
 */
export async function recordListingEvent(
  client: SupabaseClient,
  input: RecordListingEventInput,
): Promise<CommercialListingEvent | null> {
  try {
    const payload: Record<string, unknown> = {
      account_id: input.accountId,
      listing_id: input.listingId,
      actor_user_id: input.actorUserId ?? null,
      event_type: input.eventType,
      summary: input.summary,
      metadata: input.metadata ?? {},
    };
    if (input.createdAt) {
      payload.created_at = input.createdAt;
    }

    const { data, error } = await fromTable(client, 'commercial_listing_events')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[listing-events] insert failed:', error?.message);
      return null;
    }

    // Dual-write into the workspace audit feed (best-effort).
    // Skip synthetic seed rows so historical backfill does not flood Audit.
    if (input.eventType !== 'seeded') {
      void recordCommercialAccountEvent(client, {
        accountId: input.accountId,
        entityType: 'listing',
        entityId: input.listingId,
        eventType: input.eventType,
        summary: input.summary,
        actorUserId: input.actorUserId ?? null,
        metadata: {
          ...(input.metadata ?? {}),
          listingId: input.listingId,
        },
        createdAt: input.createdAt,
      });
    }

    return mapListingEvent(data as EventRow);
  } catch (err) {
    console.error('[listing-events] insert error:', err);
    return null;
  }
}

export async function listListingEvents(
  client: SupabaseClient,
  input: { accountId: string; listingId: string; limit?: number },
): Promise<CommercialListingEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const { data, error } = await fromTable(client, 'commercial_listing_events')
    .select('*')
    .eq('account_id', input.accountId)
    .eq('listing_id', input.listingId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[listing-events] list failed:', error.message);
    return [];
  }

  const events = ((data ?? []) as EventRow[]).map(mapListingEvent);
  return enrichListingEventsWithActors(client, events);
}

async function enrichListingEventsWithActors(
  client: SupabaseClient,
  events: CommercialListingEvent[],
): Promise<CommercialListingEvent[]> {
  const actorIds = [
    ...new Set(
      events
        .map((event) => event.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (actorIds.length === 0) return events;

  const { data } = await client
    .from('accounts')
    .select('id, name, picture_url')
    .in('id', actorIds);

  const actorMap = new Map(
    (
      (data ?? []) as Array<{
        id: string;
        name: string | null;
        picture_url: string | null;
      }>
    ).map((row) => [row.id, { name: row.name, pictureUrl: row.picture_url }]),
  );

  return events.map((event) => {
    const actor = event.actorUserId
      ? actorMap.get(event.actorUserId)
      : undefined;
    return {
      ...event,
      actorName: actor?.name ?? null,
      actorPictureUrl: actor?.pictureUrl ?? null,
    };
  });
}

/**
 * If the listing has no events yet, seed synthetic rows from recent related
 * activity (viewings, matches, enquiries, publications). Runs once when empty.
 */
export async function listListingEventsOrSeed(
  client: SupabaseClient,
  input: { accountId: string; listingId: string; limit?: number },
): Promise<CommercialListingEvent[]> {
  const existing = await listListingEvents(client, input);
  if (existing.length > 0) return existing;

  await seedListingEventsFromRelated(client, input);
  return listListingEvents(client, input);
}

async function seedListingEventsFromRelated(
  client: SupabaseClient,
  input: { accountId: string; listingId: string },
): Promise<void> {
  try {
    // Claim seed lock first (unique partial index on event_type = 'seeded').
    const { error: claimError } = await fromTable(
      client,
      'commercial_listing_events',
    ).insert({
      account_id: input.accountId,
      listing_id: input.listingId,
      event_type: 'seeded',
      summary: 'Activity history seeded from existing records',
      metadata: { seedClaim: true },
    });

    if (claimError) {
      // Another request claimed / already seeded.
      return;
    }

    const seeds: RecordListingEventInput[] = [];
    const [viewings, matches, enquiries, publications] = await Promise.all([
      fromTable(client, 'commercial_viewings')
        .select('id, status, outcome, scheduled_at, created_at, updated_at')
        .eq('account_id', input.accountId)
        .eq('listing_id', input.listingId)
        .order('created_at', { ascending: false })
        .limit(25),
      fromTable(client, 'commercial_matches')
        .select(
          'id, status, created_at, updated_at, commercial_requirements(company_name, contact_name)',
        )
        .eq('account_id', input.accountId)
        .eq('listing_id', input.listingId)
        .order('created_at', { ascending: false })
        .limit(25),
      fromTable(client, 'commercial_enquiries')
        .select('id, contact_name, status, source, created_at, received_at')
        .eq('account_id', input.accountId)
        .eq('listing_id', input.listingId)
        .order('created_at', { ascending: false })
        .limit(25),
      fromTable(client, 'commercial_portal_publications')
        .select('id, portal, status, last_error, last_sync_at, created_at')
        .eq('account_id', input.accountId)
        .eq('listing_id', input.listingId)
        .order('updated_at', { ascending: false })
        .limit(15),
    ]);

    for (const row of (viewings.data ?? []) as Array<Record<string, unknown>>) {
      const status = String(row.status ?? 'upcoming');
      seeds.push({
        accountId: input.accountId,
        listingId: input.listingId,
        eventType: 'viewing_created',
        summary: `Viewing (${status})${row.outcome ? ` — ${row.outcome}` : ''}`,
        metadata: { seeded: true, viewingId: row.id, status },
        createdAt: String(row.created_at ?? new Date().toISOString()),
      });
    }

    for (const row of (matches.data ?? []) as Array<Record<string, unknown>>) {
      const req = (row.commercial_requirements ?? null) as Record<
        string,
        unknown
      > | null;
      const label =
        (req?.company_name as string | null) ||
        (req?.contact_name as string | null) ||
        'Interest';
      seeds.push({
        accountId: input.accountId,
        listingId: input.listingId,
        eventType: 'match_added',
        summary: `Interest added: ${label} (${String(row.status ?? 'new')})`,
        metadata: { seeded: true, matchId: row.id, status: row.status },
        createdAt: String(row.created_at ?? new Date().toISOString()),
      });
    }

    for (const row of (enquiries.data ?? []) as Array<
      Record<string, unknown>
    >) {
      const who = (row.contact_name as string | null)?.trim() || 'Unknown';
      seeds.push({
        accountId: input.accountId,
        listingId: input.listingId,
        eventType: 'enquiry_created',
        summary: `Enquiry from ${who}`,
        metadata: {
          seeded: true,
          enquiryId: row.id,
          status: row.status,
          source: row.source,
        },
        createdAt: String(
          row.received_at ?? row.created_at ?? new Date().toISOString(),
        ),
      });
    }

    for (const row of (publications.data ?? []) as Array<
      Record<string, unknown>
    >) {
      const portal = String(row.portal ?? 'portal');
      const status = String(row.status ?? 'draft');
      const err = row.last_error ? ` — ${String(row.last_error)}` : '';
      seeds.push({
        accountId: input.accountId,
        listingId: input.listingId,
        eventType: 'portal_sync',
        summary: `Portal ${portal}: ${status}${err}`,
        metadata: {
          seeded: true,
          publicationId: row.id,
          portal,
          status,
        },
        createdAt: String(
          row.last_sync_at ?? row.created_at ?? new Date().toISOString(),
        ),
      });
    }

    if (seeds.length === 0) return;

    seeds.sort(
      (a, b) =>
        new Date(a.createdAt ?? 0).getTime() -
        new Date(b.createdAt ?? 0).getTime(),
    );

    const payload = seeds.map((seed) => ({
      account_id: seed.accountId,
      listing_id: seed.listingId,
      event_type: seed.eventType,
      summary: seed.summary,
      metadata: { ...(seed.metadata ?? {}), seedBatch: true },
      created_at: seed.createdAt ?? new Date().toISOString(),
    }));

    const { error: batchError } = await fromTable(
      client,
      'commercial_listing_events',
    ).insert(payload);

    if (batchError) {
      console.error('[listing-events] seed batch failed:', batchError.message);
    }
  } catch (err) {
    console.error('[listing-events] seed failed:', err);
  }
}
