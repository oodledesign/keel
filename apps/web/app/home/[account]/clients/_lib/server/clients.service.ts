import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { Database } from '~/lib/database.types';

import type {
  CreateClientInput,
  CreateContactInput,
  CreateNoteInput,
  DeleteClientInput,
  DeleteContactInput,
  DeleteNoteInput,
  GetClientInput,
  GetJobHistoryInput,
  ListClientInvoicesInput,
  ListClientsInput,
  ListContactsInput,
  ListNotesInput,
  UpdateClientInput,
} from '../schema/clients.schema';

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

    return (data as { account_role?: string | null } | null)?.account_role ?? null;
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

    const { page = 1, pageSize = 20, search } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = readDb
      .from('clients')
      .select('*', { count: 'exact' })
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

  async getClient(params: GetClientInput) {
    const readDb = await this.dbForClientReads(params.accountId);

    const { data, error } = await readDb
      .from('clients')
      .select('*')
      .eq('id', params.clientId)
      .eq('account_id', params.accountId)
      .single();

    if (error) throw error;
    return data;
  }

  async createClient(input: CreateClientInput) {
    const user = await this.ensureUserAndPermission(input.accountId, 'clients.edit');
    const clientType = input.client_type ?? 'business';
    const displayName =
      clientType === 'individual'
        ? [input.first_name, input.last_name].filter(Boolean).join(' ').trim() || input.first_name
        : input.company_name?.trim() || [input.first_name, input.last_name].filter(Boolean).join(' ').trim() || input.first_name;

    const { data, error } = await this.adminDb
      .from('clients')
      .insert({
        account_id: input.accountId,
        client_type: clientType,
        first_name: input.first_name,
        last_name: input.last_name ?? null,
        display_name: displayName,
        company_name: input.company_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
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

    // For individual clients, auto-create the primary contact record
    if (clientType === 'individual' && data?.id) {
      const contactName = [input.first_name, input.last_name].filter(Boolean).join(' ').trim();
      await this.adminDb.from('contacts').insert({
        user_id: user.id,
        client_id: data.id,
        full_name: contactName || input.first_name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        is_primary: true,
      });
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
      const current = (await this.getClient({ accountId: input.accountId, clientId: input.clientId })) as { first_name?: string | null; last_name?: string | null } | null;
      const first = (input.first_name ?? current?.first_name ?? '').trim();
      const last = (input.last_name ?? current?.last_name ?? '').trim();
      payload.display_name = [first, last].filter(Boolean).join(' ').trim() || first || 'Unnamed';
    }
    if (input.company_name !== undefined) payload.company_name = input.company_name;
    if (input.email !== undefined) payload.email = input.email;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.address_line_1 !== undefined) payload.address_line_1 = input.address_line_1;
    if (input.address_line_2 !== undefined) payload.address_line_2 = input.address_line_2;
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
    const user = await this.ensureUserAndPermission(input.accountId, 'clients.edit');

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

    const { data, error } = await this.db
      .from('jobs')
      .select('id, title, status, value_pence, created_at, updated_at')
      .eq('client_id', params.clientId)
      .eq('account_id', params.accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
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

  async listContacts(params: ListContactsInput) {
    await this.ensureUser();
    const { data, error } = await this.adminDb
      .from('contacts')
      .select('id, full_name, email, phone, role, is_primary, created_at')
      .eq('client_id', params.clientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { data: data ?? [] };
  }

  async createContact(input: CreateContactInput) {
    await this.ensureUser();
    const { data, error } = await this.adminDb
      .from('contacts')
      .insert({
        client_id: input.clientId,
        user_id: input.userId,
        full_name: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        role: input.role ?? null,
        is_primary: input.isPrimary ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteContact(params: DeleteContactInput) {
    await this.ensureUser();
    const { error } = await this.adminDb
      .from('contacts')
      .delete()
      .eq('id', params.contactId);

    if (error) throw error;
  }
}
