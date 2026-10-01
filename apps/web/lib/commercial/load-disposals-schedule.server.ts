import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import { type LooseQuery, looseClient } from '~/lib/retainers/loose-client';

import {
  type DisposalsScheduleInput,
  clientDisplayName,
  filterScheduleListingsForUser,
} from './disposals-schedule';

type Row = Record<string, unknown>;

const PAGE_SIZE = 1000;
const IN_CHUNK = 200;

export async function fetchAllPages(build: () => LooseQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Load every disposal (all statuses) plus units, agents, parties and joint
 * agents for the schedule export. Uses the caller's RLS-scoped client.
 * Disposals restricted to assigned agents are only included for owners/admins
 * and people on the disposal.
 */
export async function loadDisposalsScheduleInput(params: {
  client: SupabaseClient;
  accountId: string;
  accountSlug: string;
  userId: string;
  canSeeRestricted: boolean;
}): Promise<DisposalsScheduleInput> {
  const { client, accountId, userId } = params;
  const db = looseClient(client);

  const [allListings, agents] = await Promise.all([
    fetchAllPages(() =>
      db
        .from('commercial_listings')
        .select('*')
        .eq('account_id', accountId)
        .order('id'),
    ),
    fetchAllPages(() =>
      db
        .from('commercial_listing_agents')
        .select('listing_id, user_id, sort_order')
        .eq('account_id', accountId)
        .order('id'),
    ),
  ]);

  const listings = filterScheduleListingsForUser({
    listings: allListings,
    agents,
    userId,
    canSeeRestricted: params.canSeeRestricted,
  });

  const listingIds = new Set(listings.map((row) => String(row.id)));
  const inListing = (row: Row) => listingIds.has(String(row.listing_id));

  const [units, coAgents, parties, members, branches] = await Promise.all([
    fetchAllPages(() =>
      db
        .from('commercial_listing_units')
        .select('*')
        .eq('account_id', accountId)
        .order('id'),
    ),
    fetchAllPages(() =>
      db
        .from('commercial_listing_co_agents')
        .select(
          'listing_id, contact_name, contact_email, contact_phone, sort_order, clients(display_name, company_name, first_name, last_name)',
        )
        .eq('account_id', accountId)
        .order('id'),
    ),
    fetchAllPages(() =>
      db
        .from('commercial_listing_parties')
        .select(
          'listing_id, role, contact_name, contact_email, contact_phone, sort_order, clients(display_name, company_name, first_name, last_name), contacts(full_name, first_name, last_name, email, phone)',
        )
        .eq('account_id', accountId)
        .order('id'),
    ),
    client.rpc('get_account_members', { account_slug: params.accountSlug }),
    loadAccountBranches(accountId),
  ]);

  if (members.error) throw new Error(members.error.message);
  const memberNames = new Map<string, string>();
  for (const member of (members.data ?? []) as Array<{
    user_id: string;
    name?: string | null;
    email?: string | null;
  }>) {
    const name = member.name?.trim() || member.email?.trim();
    if (member.user_id && name) memberNames.set(member.user_id, name);
  }

  const clientIds = [
    ...new Set(
      listings
        .map((row) => row.instructing_client_id)
        .filter((id): id is string => typeof id === 'string' && Boolean(id)),
    ),
  ];
  const clientNames = new Map<string, string>();
  for (const ids of chunk(clientIds, IN_CHUNK)) {
    const { data, error } = await db
      .from('clients')
      .select('id, display_name, company_name, first_name, last_name')
      .eq('account_id', accountId)
      .in('id', ids);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Row[]) {
      const name = clientDisplayName(row);
      if (name) clientNames.set(String(row.id), name);
    }
  }

  return {
    listings,
    units: units.filter(inListing),
    agents: agents.filter(inListing),
    coAgents: coAgents.filter(inListing),
    parties: parties.filter(inListing),
    memberNames,
    branchNames: new Map(branches.map((branch) => [branch.id, branch.name])),
    clientNames,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXCLUDED_ROLES = new Set(['client', 'contractor']);

export type ScheduleAccess =
  | {
      ok: true;
      userId: string;
      accountSlug: string;
      canSeeRestricted: boolean;
    }
  | { ok: false; response: Response };

/**
 * Who may download disposals data: signed-in members of the workspace except
 * clients and contractors. Owners and admins also see restricted disposals.
 */
export async function resolveScheduleAccess(
  client: SupabaseClient,
  accountId: string | null | undefined,
): Promise<ScheduleAccess> {
  if (!accountId || !UUID_PATTERN.test(accountId)) {
    return {
      ok: false,
      response: new Response('A valid accountId is required', { status: 400 }),
    };
  }

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: new Response('Sign in required', { status: 401 }),
    };
  }

  const [{ data: membership }, { data: account }] = await Promise.all([
    client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle(),
    client.from('accounts').select('slug').eq('id', accountId).maybeSingle(),
  ]);

  const role = membership?.account_role as string | undefined;
  if (!role || EXCLUDED_ROLES.has(role) || !account?.slug) {
    return { ok: false, response: new Response('Forbidden', { status: 403 }) };
  }

  return {
    ok: true,
    userId: user.id,
    accountSlug: account.slug,
    canSeeRestricted: role === 'owner' || role === 'admin',
  };
}
