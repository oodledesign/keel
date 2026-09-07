/* eslint-disable @typescript-eslint/no-explicit-any -- admin query builder is untyped */
import 'server-only';

export type ChatParticipantKind = 'member' | 'client' | 'contact';

export type ThreadParticipantRow = {
  kind: ChatParticipantKind;
  user_id: string | null;
  client_id: string | null;
  contact_id: string | null;
  display_name: string;
  email: string | null;
};

export type PortalEnabledContact = {
  contactId: string;
  clientId: string;
  userId: string | null;
  name: string;
  email: string | null;
};

function composeContactName(row: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const fromParts = [row.first_name, row.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return row.full_name?.trim() || fromParts || row.email?.trim() || 'Contact';
}

export async function loadContactDisplayByIds(
  admin: any,
  contactIds: string[],
) {
  const out = new Map<string, { name: string; email: string | null }>();
  if (contactIds.length === 0) return out;

  const { data, error } = await admin
    .from('contacts')
    .select('id, full_name, first_name, last_name, email')
    .in('id', contactIds);

  if (error) {
    console.error('[messages] failed to load contact display rows', error);
    return out;
  }

  for (const row of data ?? []) {
    out.set(row.id as string, {
      name: composeContactName(row),
      email: (row.email as string | null)?.trim() || null,
    });
  }

  return out;
}

export async function loadMessageContactOptions(admin: any, accountId: string) {
  const { data: clients, error: clientError } = await admin
    .from('clients')
    .select('id, display_name, company_name, first_name, last_name')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(300);

  if (clientError) {
    console.error(
      '[messages] failed to load clients for contacts',
      clientError,
    );
    return [] as Array<{
      contactId: string;
      clientId: string;
      clientName: string;
      name: string;
      email: string | null;
      portalEnabled: boolean;
    }>;
  }

  const clientRows = clients ?? [];
  const clientIds = clientRows.map((row: { id: string }) => row.id);
  if (clientIds.length === 0) return [];

  const clientNameById = new Map<string, string>();
  for (const row of clientRows) {
    const name =
      (row.display_name as string | null)?.trim() ||
      [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
      (row.company_name as string | null)?.trim() ||
      'Client';
    clientNameById.set(row.id as string, name);
  }

  const { data: junction, error } = await admin
    .from('client_contacts')
    .select(
      'client_id, contact_id, contacts ( id, full_name, first_name, last_name, email )',
    )
    .in('client_id', clientIds);

  if (error) {
    console.error('[messages] failed to load client contacts', error);
    return [];
  }

  const portalByContact = await loadPortalEnabledContactMap(admin, clientIds);

  const out: Array<{
    contactId: string;
    clientId: string;
    clientName: string;
    name: string;
    email: string | null;
    portalEnabled: boolean;
  }> = [];

  for (const row of junction ?? []) {
    const contact = row.contacts as {
      id?: string;
      full_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    } | null;
    if (!contact?.id) continue;
    out.push({
      contactId: contact.id,
      clientId: row.client_id as string,
      clientName: clientNameById.get(row.client_id as string) ?? 'Client',
      name: composeContactName(contact),
      email: contact.email?.trim() || null,
      portalEnabled: portalByContact.has(contact.id),
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadPortalEnabledContactsForClient(
  admin: any,
  clientId: string,
): Promise<PortalEnabledContact[]> {
  const { data, error } = await admin.rpc(
    'portal_enabled_contact_ids_for_client',
    { p_client_id: clientId },
  );

  let rows: Array<{ contact_id: string; user_id: string | null }> = [];
  if (error || !data) {
    rows = await fallbackPortalEnabledContacts(admin, clientId);
  } else {
    rows = (data as Array<{ contact_id: string; user_id: string | null }>).map(
      (row) => ({
        contact_id: row.contact_id,
        user_id: row.user_id ?? null,
      }),
    );
  }

  const contactIds = Array.from(new Set(rows.map((row) => row.contact_id)));
  const display = await loadContactDisplayByIds(admin, contactIds);
  const userByContact = new Map(
    rows.map((row) => [row.contact_id, row.user_id]),
  );

  return contactIds.map((contactId) => ({
    contactId,
    clientId,
    userId: userByContact.get(contactId) ?? null,
    name: display.get(contactId)?.name ?? 'Contact',
    email: display.get(contactId)?.email ?? null,
  }));
}

async function loadPortalEnabledContactMap(admin: any, clientIds: string[]) {
  const out = new Set<string>();
  if (clientIds.length === 0) return out;

  const { data: invites } = await admin
    .from('client_portal_invites')
    .select('contact_id')
    .in('client_id', clientIds)
    .eq('status', 'accepted')
    .not('contact_id', 'is', null);

  for (const row of invites ?? []) {
    if (row.contact_id) out.add(row.contact_id as string);
  }

  return out;
}

async function fallbackPortalEnabledContacts(admin: any, clientId: string) {
  const { data: invites } = await admin
    .from('client_portal_invites')
    .select('contact_id, user_id')
    .eq('client_id', clientId)
    .eq('status', 'accepted')
    .not('contact_id', 'is', null);

  return (
    (invites ?? []) as Array<{ contact_id: string; user_id: string | null }>
  )
    .filter((row) => row.contact_id)
    .map((row) => ({
      contact_id: row.contact_id,
      user_id: row.user_id,
    }));
}

export async function loadContactIdsForUser(admin: any, userId: string) {
  const ids = new Set<string>();

  const [{ data: owned }, { data: invited }] = await Promise.all([
    admin.from('contacts').select('id').eq('user_id', userId),
    admin
      .from('client_portal_invites')
      .select('contact_id')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .not('contact_id', 'is', null),
  ]);

  for (const row of owned ?? []) ids.add(row.id as string);
  for (const row of invited ?? []) {
    if (row.contact_id) ids.add(row.contact_id as string);
  }

  return Array.from(ids);
}

export async function resolveClientOrgForClient(admin: any, clientId: string) {
  const { data } = await admin
    .from('clients')
    .select('id, account_id, client_org_id')
    .eq('id', clientId)
    .maybeSingle();

  return data as {
    id: string;
    account_id: string;
    client_org_id: string | null;
  } | null;
}
