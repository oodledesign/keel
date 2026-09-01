import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type NativeClient,
  type NativeClientContact,
  type NativeClientDetail,
  type NativeClientRow,
  mapNativeClient,
  mapNativeClientContact,
  workspaceShowsNativeClients,
} from './clients-shared';
import { NativeHttpError } from './http';
import type { NativeWorkspace } from './workspace-shared';

export type {
  NativeClient,
  NativeClientContact,
  NativeClientDetail,
} from './clients-shared';
export {
  NATIVE_CLIENT_WORKSPACE_PROFILES,
  mapNativeClient,
  mapNativeClientContact,
  workspaceShowsNativeClients,
} from './clients-shared';

const CLIENT_LIST_LIMIT = 300;

const CLIENT_SELECT =
  'id, display_name, company_name, email, first_name, last_name, client_type, picture_url';

const CONTACT_SELECT =
  'role, is_primary, created_at, contacts ( id, account_id, full_name, first_name, last_name, email, phone, contact_email_addresses ( email, is_primary ) )';

const CONTACT_SELECT_BASIC =
  'role, is_primary, created_at, contacts ( id, full_name, first_name, last_name, email, phone )';

/**
 * Clients for the selected workspace. Personal / family return `[]` (not 403)
 * so a stale phone tab never errors the user into an empty business list.
 */
export async function listNativeClients(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeClient[]> {
  if (!workspaceShowsNativeClients(workspace.profile)) {
    return [];
  }

  const rows = await loadNativeClientRows(client, workspace.id);
  return rows.map(mapNativeClient);
}

export async function getNativeClient(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  clientId: string,
): Promise<NativeClientDetail> {
  if (!workspaceShowsNativeClients(workspace.profile)) {
    throw new NativeHttpError(404, 'Client not found');
  }

  const id = clientId.trim();
  if (!id) {
    throw new NativeHttpError(404, 'Client not found');
  }

  const row = await loadNativeClientRow(client, workspace.id, id);
  if (!row) {
    throw new NativeHttpError(404, 'Client not found');
  }

  return {
    ...mapNativeClient(row),
    contacts: await loadNativeClientContacts(client, workspace.id, id),
  };
}

async function loadNativeClientRows(
  client: SupabaseClient,
  accountId: string,
): Promise<NativeClientRow[]> {
  let query = client
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('account_id', accountId)
    .order('display_name', { ascending: true, nullsFirst: false })
    .limit(CLIENT_LIST_LIMIT);

  query = query.is('archived_at', null);

  const { data, error } = await query;

  if (error) {
    if (/archived_at/i.test(error.message ?? '')) {
      const legacy = await client
        .from('clients')
        .select(CLIENT_SELECT)
        .eq('account_id', accountId)
        .order('display_name', { ascending: true, nullsFirst: false })
        .limit(CLIENT_LIST_LIMIT);

      if (legacy.error) {
        throw new Error(legacy.error.message);
      }

      return (legacy.data ?? []) as NativeClientRow[];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as NativeClientRow[];
}

async function loadNativeClientRow(
  client: SupabaseClient,
  accountId: string,
  clientId: string,
): Promise<NativeClientRow | null> {
  let query = client
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('account_id', accountId)
    .eq('id', clientId);

  query = query.is('archived_at', null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (/archived_at/i.test(error.message ?? '')) {
      const legacy = await client
        .from('clients')
        .select(CLIENT_SELECT)
        .eq('account_id', accountId)
        .eq('id', clientId)
        .maybeSingle();

      if (legacy.error) {
        throw new Error(legacy.error.message);
      }

      return (legacy.data as NativeClientRow | null) ?? null;
    }

    throw new Error(error.message);
  }

  return (data as NativeClientRow | null) ?? null;
}

type ContactLinkRow = {
  role?: string | null;
  is_primary?: boolean | null;
  contacts?: {
    id?: string | null;
    account_id?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    contact_email_addresses?: Array<{
      email?: string | null;
      is_primary?: boolean | null;
    }> | null;
  } | null;
};

async function loadNativeClientContacts(
  client: SupabaseClient,
  accountId: string,
  clientId: string,
): Promise<NativeClientContact[]> {
  const primary = await client
    .from('client_contacts')
    .select(CONTACT_SELECT)
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  let rows = (primary.data ?? []) as ContactLinkRow[];

  if (primary.error) {
    const basic = await client
      .from('client_contacts')
      .select(CONTACT_SELECT_BASIC)
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (basic.error) {
      return [];
    }

    rows = (basic.data ?? []) as ContactLinkRow[];
  }

  const contacts: NativeClientContact[] = [];

  for (const row of rows) {
    const contact = row.contacts;
    if (contact?.account_id && contact.account_id !== accountId) {
      continue;
    }

    const mapped = mapNativeClientContact({
      id: contact?.id,
      account_id: contact?.account_id,
      full_name: contact?.full_name,
      first_name: contact?.first_name,
      last_name: contact?.last_name,
      email: contact?.email,
      phone: contact?.phone,
      role: row.role,
      is_primary: row.is_primary,
      emails: contact?.contact_email_addresses,
    });

    if (mapped) {
      contacts.push(mapped);
    }
  }

  return contacts;
}
