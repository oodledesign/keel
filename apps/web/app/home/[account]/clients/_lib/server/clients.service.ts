import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  composeContactFullName,
  normalizeContactRole,
} from '~/lib/clients/contact-roles';
import { Database } from '~/lib/database.types';
import {
  DELIVERY_PROJECT_FILTER,
  PROJECTS_TABLE,
} from '~/lib/projects/delivery-project-db';
import { deliveryProjectTitle } from '~/lib/projects/project-types';

import {
  isMissingColumnError,
  isMissingRelationError,
  logMissingRelation,
} from '../../../_lib/server/supabase-errors';
import type {
  CreateClientInput,
  CreateContactInput,
  CreateNoteInput,
  CreateWorkspaceContactInput,
  DeleteClientInput,
  DeleteContactInput,
  DeleteNoteInput,
  GetClientInput,
  GetJobHistoryInput,
  LinkContactInput,
  ListAccountContactsInput,
  ListClientInvoicesInput,
  ListClientsInput,
  ListContactsInput,
  ListNotesInput,
  ListWorkspaceContactsInput,
  SetPrimaryContactInput,
  UpdateClientInput,
  UpdateContactLinkInput,
} from '../schema/clients.schema';
import { buildClientsOverview } from './clients-overview.builder';

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  if (space <= 0) return { firstName: trimmed, lastName: null };
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim() || null,
  };
}

function resolveContactNameParts(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}) {
  const fullName = composeContactFullName(input);
  if (input.firstName?.trim()) {
    return {
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      fullName,
    };
  }
  const split = splitFullName(fullName);
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    fullName,
  };
}

export function createClientsService(client: SupabaseClient<Database>) {
  return new ClientsService(client);
}

// Database types may not include clients/client_notes/projects until supabase:typegen is run after migrations.

function mapClientWriteError(err: unknown): Error {
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  const msg = typeof e?.message === 'string' ? e.message : '';
  const details = typeof e?.details === 'string' ? e.details : '';
  const blob = `${msg} ${details}`.toLowerCase();
  const code = e?.code;

  if (
    code === '42501' ||
    /row-level security/i.test(msg) ||
    /violates row-level security/i.test(msg)
  ) {
    return new Error(
      'Could not save: database blocked this action (row-level security). Run the latest migrations (`supabase db push` from apps/web), and ensure you are owner, admin, or staff on this workspace.',
    );
  }

  if (code === '23503') {
    if (blob.includes('businesses')) {
      return new Error(
        'Database still ties clients to legacy businesses, not team accounts. From apps/web run `pnpm exec supabase db push` (migrations 20260504100000 and 20260504110000). If push fails, set public.businesses.account_id for each business row, then push again. See apps/web/supabase/diagnostics/repair-clients-workspace-fk.sql.',
      );
    }
    if (blob.includes('accounts')) {
      return new Error(
        'That workspace id is not present in public.accounts (foreign key). Reload the app or confirm you opened Clients from a valid team workspace.',
      );
    }
    return new Error(
      `Could not save client (foreign key). ${details || msg || ''}`.trim(),
    );
  }

  return err instanceof Error ? err : new Error(msg || 'Failed to save client');
}

class ClientsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  /** Mutations after permission checks; bypasses RLS so policies cannot block verified staff (RLS drift). */
  private get adminDb(): any {
    return getSupabaseServerAdminClient();
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureUserAndPermission(
    accountId: string,
    permission: 'clients.view' | 'clients.edit',
  ) {
    const user = await this.ensureUser();
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (hasPermission) return user;

    // Fallback when has_permission RPC / role_permissions drift but membership role is correct.
    const { data: membership, error: membershipError } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;

    const role = membership?.account_role;
    if (permission === 'clients.edit') {
      if (role === 'owner' || role === 'admin' || role === 'staff') {
        return user;
      }
    } else if (
      permission === 'clients.view' &&
      (role === 'owner' ||
        role === 'admin' ||
        role === 'staff' ||
        role === 'contractor')
    ) {
      return user;
    }

    throw new Error('Permission denied');
  }

  private async getMembershipRole(
    accountId: string,
    userId: string,
  ): Promise<string | null> {
    const { data } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle();

    return (
      (data as { account_role?: string | null } | null)?.account_role ?? null
    );
  }

  /**
   * Contractor listing must stay on the user session so RLS narrows clients to assignments.
   * Owner/admin/staff use the admin client after permission checks so SELECT policies cannot hide
   * rows that were inserted via admin (has_role_on_account / RPC drift).
   */
  private async dbForClientReads(accountId: string): Promise<any> {
    const user = await this.ensureUserAndPermission(accountId, 'clients.view');
    const role = await this.getMembershipRole(accountId, user.id);
    if (role === 'contractor') {
      return this.db;
    }
    return this.adminDb;
  }

  async listClients(params: ListClientsInput) {
    const readDb = await this.dbForClientReads(params.accountId);
    return this.listClientsWithDb(readDb, params);
  }

  private async listClientsWithDb(readDb: any, params: ListClientsInput) {
    const { page = 1, pageSize = 20, search } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = readDb
      .from('clients')
      .select(
        'id, display_name, company_name, email, phone, city, picture_url, created_at, updated_at, first_name, last_name, client_type',
        { count: 'exact' },
      )
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `display_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},company_name.ilike.${term},email.ilike.${term}`,
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async listClientsOverview(
    params: ListClientsInput & {
      members?: Array<{
        user_id: string;
        name: string | null;
        picture_url?: string | null;
      }>;
      accountSlug?: string;
    },
  ) {
    const { members: providedMembers, accountSlug, ...listParams } = params;
    const readDb = await this.dbForClientReads(params.accountId);

    const membersPromise = (async () => {
      if (providedMembers && providedMembers.length > 0) {
        return providedMembers;
      }

      if (!accountSlug) {
        return providedMembers ?? [];
      }

      try {
        const { data } = await this.client.rpc('get_account_members', {
          account_slug: accountSlug,
        });
        return (
          (data ?? []) as Array<{
            user_id: string;
            name: string | null;
            picture_url?: string | null;
          }>
        ).map((row) => ({
          user_id: row.user_id,
          name: row.name,
          picture_url: row.picture_url,
        }));
      } catch {
        return [] as Array<{
          user_id: string;
          name: string | null;
          picture_url?: string | null;
        }>;
      }
    })();

    const [{ data, total }, members] = await Promise.all([
      this.listClientsWithDb(readDb, listParams),
      membersPromise,
    ]);

    const overview = await buildClientsOverview({
      db: readDb,
      accountId: params.accountId,
      clients: (data ?? []) as Array<{
        id: string;
        display_name: string | null;
        company_name: string | null;
        email: string | null;
        phone: string | null;
        city: string | null;
        picture_url?: string | null;
        created_at: string;
        updated_at: string;
      }>,
      members,
    });

    return { data: overview, total };
  }

  async getClient(params: GetClientInput) {
    const readDb = await this.dbForClientReads(params.accountId);

    const { data, error } = await readDb
      .from('clients')
      .select('*')
      .eq('id', params.clientId)
      .eq('account_id', params.accountId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createClient(input: CreateClientInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'clients.edit',
    );
    const clientType = input.client_type ?? 'business';
    const companyName = input.company_name?.trim() || null;
    const personFirst = input.first_name?.trim() || null;
    const personLast = input.last_name?.trim() || null;
    const displayName =
      clientType === 'individual'
        ? [personFirst, personLast].filter(Boolean).join(' ').trim() ||
          personFirst ||
          'Unnamed'
        : companyName ||
          [personFirst, personLast].filter(Boolean).join(' ').trim() ||
          'Unnamed company';

    const primaryContactEmail =
      input.contact?.email?.trim() || input.email?.trim() || null;
    const primaryContactPhone =
      input.contact?.phone?.trim() || input.phone?.trim() || null;

    const { data, error } = await this.adminDb
      .from('clients')
      .insert({
        account_id: input.accountId,
        client_type: clientType,
        first_name:
          clientType === 'individual'
            ? personFirst
            : (personFirst ?? companyName),
        last_name: personLast,
        display_name: displayName,
        company_name: companyName,
        email: primaryContactEmail ?? input.email ?? null,
        phone: primaryContactPhone ?? input.phone ?? null,
        address_line_1: input.address_line_1 ?? null,
        address_line_2: input.address_line_2 ?? null,
        city: input.city ?? null,
        postcode: input.postcode ?? null,
        country: input.country ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw mapClientWriteError(error);
    if (!data?.id) return data;

    const shouldCreateContact =
      clientType === 'individual' || Boolean(input.contact?.firstName?.trim());

    if (!shouldCreateContact) return data;

    const names =
      clientType === 'individual'
        ? resolveContactNameParts({
            firstName: personFirst,
            lastName: personLast,
          })
        : resolveContactNameParts({
            firstName: input.contact?.firstName,
            lastName: input.contact?.lastName,
          });

    const contactPayload = {
      account_id: input.accountId,
      user_id: user.id,
      client_id: data.id,
      first_name: names.firstName,
      last_name: names.lastName,
      full_name: names.fullName,
      email: primaryContactEmail,
      phone: primaryContactPhone,
      is_primary: true,
    };

    let contactInsert = await this.adminDb
      .from('contacts')
      .insert(contactPayload)
      .select('id')
      .single();

    if (contactInsert.error && isMissingColumnError(contactInsert.error)) {
      const {
        first_name: _f,
        last_name: _l,
        ...legacyPayload
      } = contactPayload;
      contactInsert = await this.adminDb
        .from('contacts')
        .insert(legacyPayload)
        .select('id')
        .single();
    }

    if (contactInsert.error) throw mapClientWriteError(contactInsert.error);

    if (contactInsert.data?.id) {
      const { error: linkError } = await this.adminDb
        .from('client_contacts')
        .insert({
          client_id: data.id,
          contact_id: contactInsert.data.id,
          role: normalizeContactRole(input.contact?.role) ?? null,
          is_primary: true,
        });
      if (linkError) throw mapClientWriteError(linkError);
    }

    return data;
  }

  async updateClient(input: UpdateClientInput) {
    await this.ensureUserAndPermission(input.accountId, 'clients.edit');

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.first_name !== undefined) payload.first_name = input.first_name;
    if (input.last_name !== undefined) payload.last_name = input.last_name;
    if (input.first_name !== undefined || input.last_name !== undefined) {
      const current = (await this.getClient({
        accountId: input.accountId,
        clientId: input.clientId,
      })) as { first_name?: string | null; last_name?: string | null } | null;
      const first = (input.first_name ?? current?.first_name ?? '').trim();
      const last = (input.last_name ?? current?.last_name ?? '').trim();
      payload.display_name =
        [first, last].filter(Boolean).join(' ').trim() || first || 'Unnamed';
    }
    if (input.company_name !== undefined)
      payload.company_name = input.company_name;
    if (input.email !== undefined) payload.email = input.email;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.address_line_1 !== undefined)
      payload.address_line_1 = input.address_line_1;
    if (input.address_line_2 !== undefined)
      payload.address_line_2 = input.address_line_2;
    if (input.city !== undefined) payload.city = input.city;
    if (input.postcode !== undefined) payload.postcode = input.postcode;
    if (input.country !== undefined) payload.country = input.country;

    const { data, error } = await this.adminDb
      .from('clients')
      .update(payload)
      .eq('id', input.clientId)
      .eq('account_id', input.accountId)
      .select()
      .single();

    if (error) throw mapClientWriteError(error);
    return data;
  }

  async deleteClient(params: DeleteClientInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.edit');

    const { error } = await this.adminDb
      .from('clients')
      .delete()
      .eq('id', params.clientId)
      .eq('account_id', params.accountId);

    if (error) throw mapClientWriteError(error);
  }

  async listNotes(params: ListNotesInput) {
    const readDb = await this.dbForClientReads(params.accountId);

    const { data, error } = await readDb
      .from('client_notes')
      .select('*')
      .eq('client_id', params.clientId)
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async createNote(input: CreateNoteInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'clients.edit',
    );

    const { data, error } = await this.adminDb
      .from('client_notes')
      .insert({
        account_id: input.accountId,
        client_id: input.clientId,
        author_user_id: user.id,
        note: input.note,
      })
      .select()
      .single();

    if (error) throw mapClientWriteError(error);
    return data;
  }

  async deleteNote(params: DeleteNoteInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.edit');

    const { error } = await this.adminDb
      .from('client_notes')
      .delete()
      .eq('id', params.noteId)
      .eq('account_id', params.accountId);

    if (error) throw mapClientWriteError(error);
  }

  async getJobHistory(params: GetJobHistoryInput) {
    await this.ensureUser();

    let result = await this.db
      .from(PROJECTS_TABLE)
      .select('id, title, name, status, value_pence, created_at, updated_at')
      .eq('client_id', params.clientId)
      .eq('account_id', params.accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
      .order('created_at', { ascending: false });

    if (result.error && isMissingColumnError(result.error)) {
      result = await this.db
        .from(PROJECTS_TABLE)
        .select('id, title, name, status, value_pence, created_at, updated_at')
        .eq('client_id', params.clientId)
        .eq('account_id', params.accountId)
        .order('created_at', { ascending: false });
    }

    if (result.error) {
      if (isMissingRelationError(result.error)) {
        const legacy = await this.db
          .from('jobs')
          .select('id, title, status, value_pence, created_at, updated_at')
          .eq('client_id', params.clientId)
          .eq('account_id', params.accountId)
          .order('created_at', { ascending: false });
        if (legacy.error) throw legacy.error;
        return legacy.data ?? [];
      }
      throw result.error;
    }

    return ((result.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        ...row,
        title: deliveryProjectTitle(
          row as { title?: string | null; name?: string | null },
        ),
      }),
    );
  }

  async listClientInvoices(params: ListClientInvoicesInput) {
    await this.ensureUser();

    const { data, error } = await this.db
      .from('invoices')
      .select(
        'id, invoice_number, status, due_at, issued_at, paid_at, total_pence, public_token, created_at',
      )
      .eq('client_id', params.clientId)
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  private async ensureClientInAccount(clientId: string, accountId: string) {
    const { data, error } = await this.adminDb
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('Client not found in this workspace.');
    }
  }

  async listContacts(params: ListContactsInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.view');
    await this.ensureClientInAccount(params.clientId, params.accountId);

    const mapJunctionRows = (
      rows: Array<{
        role?: string | null;
        is_primary?: boolean | null;
        contacts?: {
          id?: string;
          full_name?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          picture_url?: string | null;
        } | null;
      }>,
    ) =>
      rows
        .map((row) => {
          const contact = row.contacts;
          if (!contact?.id) return null;
          const fullName =
            composeContactFullName({
              firstName: contact.first_name,
              lastName: contact.last_name,
              fullName: contact.full_name,
            }) || (contact.full_name as string);
          return {
            id: contact.id as string,
            full_name: fullName,
            first_name: (contact.first_name as string | null) ?? null,
            last_name: (contact.last_name as string | null) ?? null,
            email: (contact.email as string | null) ?? null,
            phone: (contact.phone as string | null) ?? null,
            role: (row.role as string | null) ?? null,
            is_primary: Boolean(row.is_primary),
            picture_url: (contact.picture_url as string | null) ?? null,
          };
        })
        .filter(Boolean);

    const { data, error } = await this.adminDb
      .from('client_contacts')
      .select(
        'role, is_primary, created_at, contacts ( id, full_name, first_name, last_name, email, phone, picture_url )',
      )
      .eq('client_id', params.clientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error) {
      return { data: mapJunctionRows(data ?? []) };
    }

    if (isMissingColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await this.adminDb
        .from('client_contacts')
        .select(
          'role, is_primary, created_at, contacts ( id, full_name, email, phone, picture_url )',
        )
        .eq('client_id', params.clientId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (!fallbackError) {
        return { data: mapJunctionRows(fallbackData ?? []) };
      }
    }

    if (!isMissingRelationError(error)) {
      throw error;
    }

    logMissingRelation('clients.listContacts', error);

    const { data: legacyRows, error: legacyError } = await this.adminDb
      .from('contacts')
      .select(
        'id, full_name, email, phone, role, is_primary, created_at, picture_url',
      )
      .eq('client_id', params.clientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (legacyError && isMissingColumnError(legacyError)) {
      const { data: legacyWithoutPhoto, error: legacyWithoutPhotoError } =
        await this.adminDb
          .from('contacts')
          .select('id, full_name, email, phone, role, is_primary, created_at')
          .eq('client_id', params.clientId)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true });

      if (legacyWithoutPhotoError) throw legacyWithoutPhotoError;

      return {
        data: (legacyWithoutPhoto ?? []).map(
          (row: {
            id: string;
            full_name: string;
            email: string | null;
            phone: string | null;
            role: string | null;
            is_primary: boolean;
          }) => ({
            id: row.id,
            full_name: row.full_name,
            first_name: null,
            last_name: null,
            email: row.email,
            phone: row.phone,
            role: row.role,
            is_primary: row.is_primary,
            picture_url: null,
          }),
        ),
      };
    }

    if (legacyError) throw legacyError;

    return {
      data: (legacyRows ?? []).map(
        (row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: string | null;
          is_primary: boolean;
          picture_url?: string | null;
        }) => ({
          id: row.id,
          full_name: row.full_name,
          first_name: null,
          last_name: null,
          email: row.email,
          phone: row.phone,
          role: row.role,
          is_primary: row.is_primary,
          picture_url: row.picture_url ?? null,
        }),
      ),
    };
  }

  async listAccountContacts(params: ListAccountContactsInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.view');
    await this.ensureClientInAccount(params.clientId, params.accountId);

    const { data: linkedRows, error: linkedError } = await this.adminDb
      .from('client_contacts')
      .select('contact_id')
      .eq('client_id', params.clientId);

    const linkedIds = new Set<string>();
    if (!linkedError) {
      for (const row of linkedRows ?? []) {
        linkedIds.add((row as { contact_id: string }).contact_id);
      }
    } else if (!isMissingRelationError(linkedError)) {
      throw linkedError;
    } else {
      logMissingRelation('clients.listAccountContacts.links', linkedError);
      const { data: legacyLinked } = await this.adminDb
        .from('contacts')
        .select('id')
        .eq('client_id', params.clientId);
      for (const row of legacyLinked ?? []) {
        linkedIds.add((row as { id: string }).id);
      }
    }

    const query = this.adminDb
      .from('contacts')
      .select('id, full_name, email, phone, picture_url')
      .order('full_name', { ascending: true })
      .limit(100);

    const { data: scopedRows, error: scopedError } = await query.eq(
      'account_id',
      params.accountId,
    );

    let data = scopedRows;
    let error = scopedError;

    if (error && isMissingColumnError(error)) {
      const { data: accountClients, error: clientsError } = await this.adminDb
        .from('clients')
        .select('id')
        .eq('account_id', params.accountId);

      if (clientsError) throw clientsError;

      const clientIds = (accountClients ?? []).map(
        (row: { id: string }) => row.id,
      );

      const fallback = clientIds.length
        ? await this.adminDb
            .from('contacts')
            .select('id, full_name, email, phone')
            .in('client_id', clientIds)
            .order('full_name', { ascending: true })
            .limit(200)
        : { data: [], error: null };

      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const search = params.query?.trim().toLowerCase();
    let contacts = (data ?? []).filter(
      (row: { id: string }) => !linkedIds.has(row.id),
    );

    if (search) {
      contacts = contacts.filter(
        (row: { full_name?: string | null; email?: string | null }) => {
          const name = row.full_name?.toLowerCase() ?? '';
          const email = row.email?.toLowerCase() ?? '';
          return name.includes(search) || email.includes(search);
        },
      );
    }

    return { data: contacts.slice(0, 50) };
  }

  async createContact(input: CreateContactInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'clients.edit',
    );
    await this.ensureClientInAccount(input.clientId, input.accountId);

    const names = resolveContactNameParts({
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
    });
    const role = normalizeContactRole(input.role);

    const { data: contact, error } = await this.adminDb
      .from('contacts')
      .insert({
        account_id: input.accountId,
        user_id: user.id,
        first_name: names.firstName,
        last_name: names.lastName,
        full_name: names.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
      })
      .select('id')
      .single();

    let contactRow = contact;
    let contactError = error;

    if (contactError && isMissingColumnError(contactError)) {
      const legacyInsert = await this.adminDb
        .from('contacts')
        .insert({
          user_id: user.id,
          client_id: input.clientId,
          full_name: names.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          role: role ?? null,
          is_primary: input.isPrimary ?? false,
        })
        .select('id')
        .single();
      contactRow = legacyInsert.data;
      contactError = legacyInsert.error;
    }

    if (contactError) throw contactError;
    if (!contactRow?.id) throw new Error('Failed to create contact');

    const { error: linkError } = await this.adminDb
      .from('client_contacts')
      .insert({
        client_id: input.clientId,
        contact_id: contactRow.id,
        role: role ?? null,
        is_primary: input.isPrimary ?? false,
      });

    if (linkError) {
      if (isMissingRelationError(linkError)) {
        logMissingRelation('clients.createContact.link', linkError);
        await this.adminDb
          .from('contacts')
          .update({
            client_id: input.clientId,
            role: role ?? null,
            is_primary: input.isPrimary ?? false,
          })
          .eq('id', contactRow.id);
      } else {
        throw mapClientWriteError(linkError);
      }
    }
    return contactRow;
  }

  async setPrimaryContact(input: SetPrimaryContactInput) {
    await this.ensureUserAndPermission(input.accountId, 'clients.edit');
    await this.ensureClientInAccount(input.clientId, input.accountId);

    const { data: link, error: linkError } = await this.adminDb
      .from('client_contacts')
      .select('contact_id')
      .eq('client_id', input.clientId)
      .eq('contact_id', input.contactId)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      throw new Error('Contact is not linked to this client.');
    }

    const { error: clearError } = await this.adminDb
      .from('client_contacts')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('client_id', input.clientId)
      .eq('is_primary', true);

    if (clearError && !isMissingColumnError(clearError)) throw clearError;

    const { error: setError } = await this.adminDb
      .from('client_contacts')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('client_id', input.clientId)
      .eq('contact_id', input.contactId);

    if (setError) throw mapClientWriteError(setError);
    return { ok: true as const };
  }

  async updateContactLink(input: UpdateContactLinkInput) {
    await this.ensureUserAndPermission(input.accountId, 'clients.edit');
    await this.ensureClientInAccount(input.clientId, input.accountId);

    const role =
      input.role === undefined
        ? undefined
        : input.role === null
          ? null
          : normalizeContactRole(input.role);

    const { error } = await this.adminDb
      .from('client_contacts')
      .update({
        ...(role !== undefined ? { role } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', input.clientId)
      .eq('contact_id', input.contactId);

    if (error) throw mapClientWriteError(error);
    return { ok: true as const };
  }

  async linkContact(input: LinkContactInput) {
    await this.ensureUserAndPermission(input.accountId, 'clients.edit');
    await this.ensureClientInAccount(input.clientId, input.accountId);

    const { data: contact, error: contactError } = await this.adminDb
      .from('contacts')
      .select('id')
      .eq('id', input.contactId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (contactError) throw contactError;
    if (!contact) {
      throw new Error('Contact not found in this workspace.');
    }

    const { error: linkError } = await this.adminDb
      .from('client_contacts')
      .insert({
        client_id: input.clientId,
        contact_id: input.contactId,
        role: normalizeContactRole(input.role) ?? null,
        is_primary: input.isPrimary ?? false,
      });

    if (linkError) {
      if (linkError.code === '23505') {
        throw new Error('This contact is already linked to this client.');
      }
      if (isMissingRelationError(linkError)) {
        throw new Error(
          'Shared contacts require the latest database migration. Run `pnpm exec supabase db push` from apps/web.',
        );
      }
      throw mapClientWriteError(linkError);
    }
  }

  async deleteContact(params: DeleteContactInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.edit');
    await this.ensureClientInAccount(params.clientId, params.accountId);

    const { error: unlinkError } = await this.adminDb
      .from('client_contacts')
      .delete()
      .eq('client_id', params.clientId)
      .eq('contact_id', params.contactId);

    if (unlinkError) throw unlinkError;

    const { count, error: countError } = await this.adminDb
      .from('client_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', params.contactId);

    if (countError) throw countError;

    if ((count ?? 0) === 0) {
      const { error: deleteError } = await this.adminDb
        .from('contacts')
        .delete()
        .eq('id', params.contactId);

      if (deleteError) throw deleteError;
    }
  }

  async listWorkspaceContacts(params: ListWorkspaceContactsInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.view');

    const { data, error } = await this.adminDb
      .from('contacts')
      .select('id, full_name, email, phone, picture_url')
      .eq('account_id', params.accountId)
      .order('full_name', { ascending: true })
      .limit(500);

    if (!error) {
      return {
        data: (data ?? []).map(
          (row: {
            id: string;
            full_name: string;
            email: string | null;
            phone: string | null;
            picture_url?: string | null;
          }) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            picture_url: row.picture_url ?? null,
          }),
        ),
      };
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }

    const { data: withoutPhoto, error: withoutPhotoError } = await this.adminDb
      .from('contacts')
      .select('id, full_name, email, phone')
      .eq('account_id', params.accountId)
      .order('full_name', { ascending: true })
      .limit(500);

    if (!withoutPhotoError) {
      return {
        data: (withoutPhoto ?? []).map(
          (row: {
            id: string;
            full_name: string;
            email: string | null;
            phone: string | null;
          }) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            picture_url: null,
          }),
        ),
      };
    }

    const { data: accountClients, error: clientsError } = await this.adminDb
      .from('clients')
      .select('id')
      .eq('account_id', params.accountId);

    if (clientsError) throw clientsError;

    const clientIds = (accountClients ?? []).map(
      (row: { id: string }) => row.id,
    );
    if (clientIds.length === 0) {
      return { data: [] };
    }

    const { data: junctionRows, error: junctionError } = await this.adminDb
      .from('client_contacts')
      .select(
        'contact_id, contacts ( id, full_name, email, phone, picture_url )',
      )
      .in('client_id', clientIds);

    if (!junctionError) {
      const byId = new Map<
        string,
        {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          picture_url: string | null;
        }
      >();

      for (const row of junctionRows ?? []) {
        const contact = (
          row as {
            contacts?: {
              id?: string;
              full_name?: string;
              email?: string | null;
              phone?: string | null;
              picture_url?: string | null;
            } | null;
          }
        ).contacts;
        if (!contact?.id || !contact.full_name) continue;
        byId.set(contact.id, {
          id: contact.id,
          full_name: contact.full_name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          picture_url: contact.picture_url ?? null,
        });
      }

      return {
        data: [...byId.values()].sort((a, b) =>
          a.full_name.localeCompare(b.full_name),
        ),
      };
    }

    if (!isMissingRelationError(junctionError)) {
      throw junctionError;
    }

    const { data: legacyRows, error: legacyError } = await this.adminDb
      .from('contacts')
      .select('id, full_name, email, phone, picture_url')
      .in('client_id', clientIds)
      .order('full_name', { ascending: true });

    if (legacyError) throw legacyError;

    const byId = new Map<
      string,
      {
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        picture_url: string | null;
      }
    >();
    for (const row of legacyRows ?? []) {
      const contact = row as {
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        picture_url?: string | null;
      };
      byId.set(contact.id, {
        ...contact,
        picture_url: contact.picture_url ?? null,
      });
    }

    return { data: [...byId.values()] };
  }

  async createWorkspaceContact(input: CreateWorkspaceContactInput) {
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'clients.edit',
    );

    if (input.linkClientId) {
      await this.ensureClientInAccount(input.linkClientId, input.accountId);
    }

    const names = resolveContactNameParts({
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
    });

    const { data: contact, error } = await this.adminDb
      .from('contacts')
      .insert({
        account_id: input.accountId,
        user_id: user.id,
        first_name: names.firstName,
        last_name: names.lastName,
        full_name: names.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
      })
      .select('id, full_name, email, phone')
      .single();

    let contactRow = contact;
    let contactError = error;

    if (contactError && isMissingColumnError(contactError)) {
      const legacyInsert = await this.adminDb
        .from('contacts')
        .insert({
          user_id: user.id,
          client_id: input.linkClientId ?? null,
          full_name: names.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
        })
        .select('id, full_name, email, phone')
        .single();
      contactRow = legacyInsert.data;
      contactError = legacyInsert.error;
    }

    if (contactError) throw mapClientWriteError(contactError);
    if (!contactRow?.id) throw new Error('Failed to create contact');

    if (input.linkClientId) {
      const { error: linkError } = await this.adminDb
        .from('client_contacts')
        .insert({
          client_id: input.linkClientId,
          contact_id: contactRow.id,
        });

      if (linkError && !isMissingRelationError(linkError)) {
        throw mapClientWriteError(linkError);
      }
    }

    return contactRow;
  }
}
