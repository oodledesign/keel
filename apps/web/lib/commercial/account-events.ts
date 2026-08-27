import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Tables not yet in generated Database types — unwrap until typegen. */
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export type CommercialAccountEntityType =
  | 'listing'
  | 'client'
  | 'requirement'
  | 'viewing'
  | 'other';

export type CommercialAccountEvent = {
  id: string;
  accountId: string;
  actorUserId: string | null;
  entityType: CommercialAccountEntityType;
  entityId: string;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName?: string | null;
  actorPictureUrl?: string | null;
  entityLabel?: string | null;
};

export type RecordCommercialAccountEventInput = {
  accountId: string;
  entityType: CommercialAccountEntityType;
  entityId: string;
  eventType: string;
  summary: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type EventRow = {
  id: string;
  account_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function mapCommercialAccountEvent(
  row: EventRow,
): CommercialAccountEvent {
  return {
    id: row.id,
    accountId: row.account_id,
    actorUserId: row.actor_user_id,
    entityType: row.entity_type as CommercialAccountEntityType,
    entityId: row.entity_id,
    eventType: row.event_type,
    summary: row.summary,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

/**
 * Best-effort account audit insert. Never throws — callers should not fail main ops.
 */
export async function recordCommercialAccountEvent(
  client: SupabaseClient,
  input: RecordCommercialAccountEventInput,
): Promise<CommercialAccountEvent | null> {
  try {
    const payload: Record<string, unknown> = {
      account_id: input.accountId,
      actor_user_id: input.actorUserId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      event_type: input.eventType,
      summary: input.summary,
      metadata: input.metadata ?? {},
    };
    if (input.createdAt) {
      payload.created_at = input.createdAt;
    }

    const { data, error } = await fromTable(client, 'commercial_account_events')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[account-events] insert failed:', error?.message);
      return null;
    }

    return mapCommercialAccountEvent(data as EventRow);
  } catch (err) {
    console.error('[account-events] insert error:', err);
    return null;
  }
}

export async function listCommercialAccountEvents(
  client: SupabaseClient,
  input: {
    accountId: string;
    entityType?: CommercialAccountEntityType;
    actorUserId?: string;
    limit?: number;
    cursor?: string;
  },
): Promise<CommercialAccountEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  let query = fromTable(client, 'commercial_account_events')
    .select('*')
    .eq('account_id', input.accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input.entityType) {
    query = query.eq('entity_type', input.entityType);
  }
  if (input.actorUserId) {
    query = query.eq('actor_user_id', input.actorUserId);
  }
  if (input.cursor) {
    query = query.lt('created_at', input.cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[account-events] list failed:', error.message);
    return [];
  }

  const events = ((data ?? []) as EventRow[]).map(mapCommercialAccountEvent);
  return enrichCommercialAccountEvents(client, input.accountId, events);
}

async function enrichCommercialAccountEvents(
  client: SupabaseClient,
  accountId: string,
  events: CommercialAccountEvent[],
): Promise<CommercialAccountEvent[]> {
  if (events.length === 0) return events;

  const actorIds = [
    ...new Set(
      events
        .map((event) => event.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const listingIds = [
    ...new Set(
      events
        .filter((event) => event.entityType === 'listing')
        .map((event) => event.entityId),
    ),
  ];
  const clientIds = [
    ...new Set(
      events
        .filter((event) => event.entityType === 'client')
        .map((event) => event.entityId),
    ),
  ];

  const [actorsRes, listingsRes, clientsRes] = await Promise.all([
    actorIds.length
      ? client
          .from('accounts')
          .select('id, name, picture_url')
          .in('id', actorIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string | null;
            picture_url: string | null;
          }>,
        }),
    listingIds.length
      ? fromTable(client, 'commercial_listings')
          .select('id, name')
          .eq('account_id', accountId)
          .in('id', listingIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; name: string | null }>,
        }),
    clientIds.length
      ? client
          .from('clients')
          .select('id, display_name, company_name')
          .eq('account_id', accountId)
          .in('id', clientIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            display_name: string | null;
            company_name: string | null;
          }>,
        }),
  ]);

  const actorMap = new Map(
    (
      (actorsRes.data ?? []) as Array<{
        id: string;
        name: string | null;
        picture_url: string | null;
      }>
    ).map((row) => [row.id, { name: row.name, pictureUrl: row.picture_url }]),
  );
  const listingMap = new Map(
    (
      (listingsRes.data ?? []) as Array<{ id: string; name: string | null }>
    ).map((row) => [row.id, row.name]),
  );
  const clientMap = new Map(
    (
      (clientsRes.data ?? []) as Array<{
        id: string;
        display_name: string | null;
        company_name: string | null;
      }>
    ).map((row) => [
      row.id,
      row.display_name?.trim() || row.company_name?.trim() || null,
    ]),
  );

  return events.map((event) => {
    const actor = event.actorUserId
      ? actorMap.get(event.actorUserId)
      : undefined;
    let entityLabel: string | null = null;
    if (event.entityType === 'listing') {
      entityLabel =
        listingMap.get(event.entityId) ??
        (typeof event.metadata.name === 'string'
          ? event.metadata.name
          : null);
    } else if (event.entityType === 'client') {
      entityLabel = clientMap.get(event.entityId) ?? null;
    }

    return {
      ...event,
      actorName: actor?.name ?? null,
      actorPictureUrl: actor?.pictureUrl ?? null,
      entityLabel,
    };
  });
}
