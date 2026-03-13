import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { Database } from '~/lib/database.types';

import type {
  CreateClientInput,
  CreateNoteInput,
  DeleteClientInput,
  DeleteNoteInput,
  GetClientInput,
  GetJobHistoryInput,
  ListClientInvoicesInput,
  ListClientsInput,
  ListNotesInput,
  UpdateClientInput,
} from '../schema/clients.schema';

export function createClientsService(client: SupabaseClient<Database>) {
  return new ClientsService(client);
}

// Database types may not include clients/client_notes/projects until supabase:typegen is run after migrations.
 
class ClientsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
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
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  /** Read operations use RLS; only require auth so members see what RLS allows (works before role_permissions has clients.view). */
  async listClients(params: ListClientsInput) {
    await this.ensureUser();

    const { page = 1, pageSize = 20, search } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.db
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
    await this.ensureUser();

    const { data, error } = await this.db
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
    const displayName = [input.first_name, input.last_name].filter(Boolean).join(' ').trim() || input.first_name;

    const { data, error } = await this.db
      .from('clients')
      .insert({
        account_id: input.accountId,
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

    if (error) throw error;
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

    const { data, error } = await this.db
      .from('clients')
      .update(payload)
      .eq('id', input.clientId)
      .eq('account_id', input.accountId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteClient(params: DeleteClientInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.edit');

    const { error } = await this.db
      .from('clients')
      .delete()
      .eq('id', params.clientId)
      .eq('account_id', params.accountId);

    if (error) throw error;
  }

  async listNotes(params: ListNotesInput) {
    await this.ensureUser();

    const { data, error } = await this.db
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

    const { data, error } = await this.db
      .from('client_notes')
      .insert({
        account_id: input.accountId,
        client_id: input.clientId,
        author_user_id: user.id,
        note: input.note,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteNote(params: DeleteNoteInput) {
    await this.ensureUserAndPermission(params.accountId, 'clients.edit');

    const { error } = await this.db
      .from('client_notes')
      .delete()
      .eq('id', params.noteId)
      .eq('account_id', params.accountId);

    if (error) throw error;
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
}
