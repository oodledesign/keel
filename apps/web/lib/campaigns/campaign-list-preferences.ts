import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeCirculationEmail } from '~/lib/commercial/circulation/circulation-eligibility';

import { composeCampaignContactName } from './campaign-contact-csv';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export type PublicAudienceListPreference = {
  id: string;
  name: string;
  subscribed: boolean;
};

type PublicAudienceListRow = {
  id: string;
  name: string;
  source: string;
};

export async function loadListOptOutEmails(
  client: SupabaseClient,
  accountId: string,
  listId: string,
): Promise<Set<string>> {
  const { data, error } = await fromTable(
    client,
    'campaign_audience_list_opt_outs',
  )
    .select('email')
    .eq('account_id', accountId)
    .eq('list_id', listId);

  if (error) throw new Error(error.message);

  return new Set(
    ((data ?? []) as Array<{ email: string }>).map((row) =>
      normalizeCirculationEmail(row.email),
    ),
  );
}

export async function listPublicAudienceLists(
  client: SupabaseClient,
  accountId: string,
): Promise<PublicAudienceListRow[]> {
  const { data, error } = await fromTable(client, 'campaign_audience_lists')
    .select('id, name, source')
    .eq('account_id', accountId)
    .eq('is_public', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    source: String(row.source),
  }));
}

export async function listPublicAudiencePreferences(
  client: SupabaseClient,
  accountId: string,
  email: string,
): Promise<PublicAudienceListPreference[]> {
  const normalized = normalizeCirculationEmail(email);
  const lists = await listPublicAudienceLists(client, accountId);
  if (lists.length === 0) return [];

  const listIds = lists.map((list) => list.id);

  const contactIds = await findContactIdsByEmail(client, accountId, normalized);

  const [{ data: optOuts, error: optOutError }, members] = await Promise.all([
    fromTable(client, 'campaign_audience_list_opt_outs')
      .select('list_id')
      .eq('account_id', accountId)
      .eq('email', normalized)
      .in('list_id', listIds),
    contactIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ list_id: string }>, error: null })
      : fromTable(client, 'campaign_audience_list_members')
          .select('list_id')
          .eq('account_id', accountId)
          .in('list_id', listIds)
          .in('contact_id', contactIds),
  ]);

  if (optOutError) throw new Error(optOutError.message);
  if (members.error) throw new Error(members.error.message);

  const optedOut = new Set(
    ((optOuts ?? []) as Array<{ list_id: string }>).map((row) => row.list_id),
  );
  const memberListIds = new Set(
    ((members.data ?? []) as Array<{ list_id: string }>).map((row) =>
      String(row.list_id),
    ),
  );

  return lists.map((list) => {
    const left = optedOut.has(list.id);
    const subscribed =
      !left && (list.source === 'manual' ? memberListIds.has(list.id) : true);
    return {
      id: list.id,
      name: list.name,
      subscribed,
    };
  });
}

export async function leaveAllPublicAudienceLists(
  client: SupabaseClient,
  accountId: string,
  email: string,
): Promise<void> {
  const lists = await listPublicAudienceLists(client, accountId);
  if (lists.length === 0) return;

  const normalized = normalizeCirculationEmail(email);
  const rows = lists.map((list) => ({
    account_id: accountId,
    list_id: list.id,
    email: normalized,
  }));

  const { error } = await fromTable(
    client,
    'campaign_audience_list_opt_outs',
  ).upsert(rows, { onConflict: 'list_id,email', ignoreDuplicates: true });

  if (error) throw new Error(error.message);

  const manualIds = lists
    .filter((list) => list.source === 'manual')
    .map((list) => list.id);
  if (manualIds.length === 0) return;

  const contactIds = await findContactIdsByEmail(client, accountId, normalized);
  if (contactIds.length === 0) return;

  const { error: removeError } = await fromTable(
    client,
    'campaign_audience_list_members',
  )
    .delete()
    .eq('account_id', accountId)
    .in('list_id', manualIds)
    .in('contact_id', contactIds);

  if (removeError) throw new Error(removeError.message);
}

export async function setPublicAudienceListSubscription(input: {
  client: SupabaseClient;
  accountId: string;
  email: string;
  listId: string;
  subscribed: boolean;
}): Promise<PublicAudienceListPreference | null> {
  const { data: list, error } = await fromTable(
    input.client,
    'campaign_audience_lists',
  )
    .select('id, name, source, is_public')
    .eq('account_id', input.accountId)
    .eq('id', input.listId)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!list) return null;

  const normalized = normalizeCirculationEmail(input.email);

  if (input.subscribed) {
    const { error: clearError } = await fromTable(
      input.client,
      'campaign_audience_list_opt_outs',
    )
      .delete()
      .eq('account_id', input.accountId)
      .eq('list_id', input.listId)
      .eq('email', normalized);

    if (clearError) throw new Error(clearError.message);

    if (list.source === 'manual') {
      await addManualListMemberByEmail({
        client: input.client,
        accountId: input.accountId,
        listId: input.listId,
        email: normalized,
      });
    }
  } else {
    const { error: optOutError } = await fromTable(
      input.client,
      'campaign_audience_list_opt_outs',
    ).upsert(
      {
        account_id: input.accountId,
        list_id: input.listId,
        email: normalized,
      },
      { onConflict: 'list_id,email', ignoreDuplicates: true },
    );

    if (optOutError) throw new Error(optOutError.message);

    if (list.source === 'manual') {
      const contactIds = await findContactIdsByEmail(
        input.client,
        input.accountId,
        normalized,
      );
      if (contactIds.length > 0) {
        const { error: removeError } = await fromTable(
          input.client,
          'campaign_audience_list_members',
        )
          .delete()
          .eq('account_id', input.accountId)
          .eq('list_id', input.listId)
          .in('contact_id', contactIds);

        if (removeError) throw new Error(removeError.message);
      }
    }
  }

  return {
    id: String(list.id),
    name: String(list.name),
    subscribed: input.subscribed,
  };
}

async function findContactIdsByEmail(
  client: SupabaseClient,
  accountId: string,
  email: string,
): Promise<string[]> {
  const { data, error } = await fromTable(client, 'contacts')
    .select('id')
    .eq('account_id', accountId)
    .ilike('email', email);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{ id: string }>).map((row) => String(row.id));
}

async function addManualListMemberByEmail(input: {
  client: SupabaseClient;
  accountId: string;
  listId: string;
  email: string;
}): Promise<void> {
  const existing = await findContactIdsByEmail(
    input.client,
    input.accountId,
    input.email,
  );
  let contactId = existing[0] ?? null;

  if (!contactId) {
    const names = composeCampaignContactName({ email: input.email });
    const { data, error } = await fromTable(input.client, 'contacts')
      .insert({
        account_id: input.accountId,
        email: input.email,
        first_name: names.firstName,
        last_name: names.lastName,
        full_name: names.fullName,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save contact');
    }
    // Public opt-in is scoped to the token email — never invent another address.
    contactId = String((data as { id: string }).id);
  }

  const { error } = await fromTable(
    input.client,
    'campaign_audience_list_members',
  ).upsert(
    {
      account_id: input.accountId,
      list_id: input.listId,
      contact_id: contactId,
    },
    { onConflict: 'list_id,contact_id', ignoreDuplicates: true },
  );

  if (error) throw new Error(error.message);
}
