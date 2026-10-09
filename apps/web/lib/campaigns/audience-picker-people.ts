import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { listWorkspaceMailingListSubscribers } from '~/lib/workspace-forms/workspace-mailing-list';

export type AudiencePickerPerson = {
  id: string;
  email: string;
  displayName: string;
};

export type AudiencePickerKind = 'clients' | 'contacts';

/** People sent with the page before anyone searches. */
const PRELOAD_LIMIT = 50;
const SEARCH_LIMIT = 20;
/** Ids go in the request URL, which has a size cap. */
const ID_BATCH = 200;

type Row = Record<string, unknown>;

const text = (value: unknown) => String(value ?? '').trim();
const joinedName = (row: Row) =>
  [text(row.first_name), text(row.last_name)].filter(Boolean).join(' ');

const SOURCES = {
  contacts: {
    table: 'contacts',
    select: 'id, email, full_name, first_name, last_name, company_name',
    orderBy: 'full_name',
    search: ['email', 'full_name', 'first_name', 'last_name', 'company_name'],
    displayName: (row: Row) => text(row.full_name) || joinedName(row),
  },
  clients: {
    table: 'clients',
    select: 'id, email, display_name, first_name, last_name, company_name',
    orderBy: 'display_name',
    search: [
      'email',
      'display_name',
      'first_name',
      'last_name',
      'company_name',
    ],
    displayName: (row: Row) =>
      text(row.display_name) || joinedName(row) || text(row.company_name),
  },
} as const;

function peopleQuery(
  client: SupabaseClient,
  accountId: string,
  kind: AudiencePickerKind,
  options: { count?: boolean } = {},
) {
  const source = SOURCES[kind];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from(source.table)
    .select(
      options.count ? 'id' : source.select,
      options.count ? { count: 'exact', head: true } : undefined,
    )
    .eq('account_id', accountId)
    .not('email', 'is', null)
    .neq('email', '');
  if (kind === 'clients') query = query.is('archived_at', null);
  return query;
}

function toPeople(
  kind: AudiencePickerKind,
  rows: Row[],
): AudiencePickerPerson[] {
  const people: AudiencePickerPerson[] = [];
  for (const row of rows) {
    const email = text(row.email).toLowerCase();
    if (!email) continue;
    people.push({
      id: String(row.id),
      email,
      displayName: SOURCES[kind].displayName(row) || email,
    });
  }
  return people;
}

function sortByName(people: AudiencePickerPerson[]) {
  return [...people].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: 'base',
    }),
  );
}

/** First people by name, plus `ids` (people already picked) wherever they sort. */
export async function listAudiencePickerPeople(
  client: SupabaseClient,
  accountId: string,
  kind: AudiencePickerKind,
  ids: string[] = [],
): Promise<AudiencePickerPerson[]> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += ID_BATCH) {
    batches.push(unique.slice(i, i + ID_BATCH));
  }

  const [first, ...picked] = await Promise.all([
    peopleQuery(client, accountId, kind)
      .order(SOURCES[kind].orderBy, { ascending: true })
      .limit(PRELOAD_LIMIT),
    ...batches.map((batch) =>
      peopleQuery(client, accountId, kind).in('id', batch),
    ),
  ]);

  const byId = new Map<string, AudiencePickerPerson>();
  for (const result of [first, ...picked]) {
    if (result.error) throw new Error(result.error.message);
    for (const person of toPeople(kind, result.data ?? [])) {
      byId.set(person.id, person);
    }
  }
  return sortByName([...byId.values()]);
}

export async function searchAudiencePickerPeople(
  client: SupabaseClient,
  accountId: string,
  kind: AudiencePickerKind,
  query: string,
): Promise<AudiencePickerPerson[]> {
  // Commas and brackets would break the `or` filter; % and _ are wildcards.
  const term = query.replace(/[%_,()\\*]/g, ' ').trim();
  if (!term) return [];

  const like = `%${term}%`;
  const { data, error } = await peopleQuery(client, accountId, kind)
    .or(
      SOURCES[kind].search.map((column) => `${column}.ilike.${like}`).join(','),
    )
    .order(SOURCES[kind].orderBy, { ascending: true })
    .limit(SEARCH_LIMIT);
  if (error) throw new Error(error.message);
  return toPeople(kind, data ?? []);
}

async function countAudiencePickerPeople(
  client: SupabaseClient,
  accountId: string,
  kind: AudiencePickerKind,
): Promise<number> {
  const { count, error } = await peopleQuery(client, accountId, kind, {
    count: true,
  });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Pickers get a short starting list (plus anyone already picked) and search
 * the database for the rest, so pages stay small however many people a
 * workspace has.
 */
export async function listAudiencePickerOptions(
  client: SupabaseClient,
  accountId: string,
  picked: { clientIds?: string[]; contactIds?: string[] } = {},
): Promise<{
  clients: AudiencePickerPerson[];
  contacts: AudiencePickerPerson[];
  subscriberCount: number;
  clientCount: number;
  contactCount: number;
}> {
  const [clients, contacts, clientCount, contactCount, subscribers] =
    await Promise.all([
      listAudiencePickerPeople(client, accountId, 'clients', picked.clientIds),
      listAudiencePickerPeople(
        client,
        accountId,
        'contacts',
        picked.contactIds,
      ),
      countAudiencePickerPeople(client, accountId, 'clients'),
      countAudiencePickerPeople(client, accountId, 'contacts'),
      listWorkspaceMailingListSubscribers(client, accountId),
    ]);

  return {
    clients,
    contacts,
    subscriberCount: subscribers.length,
    clientCount,
    contactCount,
  };
}
