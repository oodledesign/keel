import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import type {
  AddTicketMessageInput,
  CreateTicketInput,
  GetTicketInput,
  ListTicketsInput,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from '../schema/support-tickets.schema';

export type SupportTicket = {
  id: string;
  businessId: string;
  clientOrgId: string | null;
  websiteId: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  ticketNumber: number;
  assignedTo: string | null;
  createdBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientOrgName: string | null;
  websiteName: string | null;
  websiteDomain: string | null;
  assignedToName: string | null;
  createdByName: string | null;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
};

export type ClientOrgOption = { id: string; name: string };
export type WebsiteOption = { id: string; name: string; domain: string | null };
export type TeamMemberOption = {
  userId: string;
  name: string;
};

type TicketRow = {
  id: string;
  business_id?: string | null;
  account_id?: string | null;
  client_org_id?: string | null;
  website_id?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  ticket_number?: number | null;
  assigned_to?: string | null;
  created_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  client_orgs?: { name?: string | null } | { name?: string | null }[] | null;
  websites?:
    | { name?: string | null; domain?: string | null }
    | Array<{
        name?: string | null;
        domain?: string | null;
      }>
    | null;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

function supportTicketAccountFilter(accountId: string) {
  return `business_id.eq.${accountId},account_id.eq.${accountId}`;
}

export async function countOpenSupportTickets(
  client: SupabaseClient,
  accountId: string,
) {
  const { count, error } = await client
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .or(supportTicketAccountFilter(accountId))
    .in('status', ['open', 'in-progress', 'waiting']);

  if (error) {
    const message = [error.message, error.details, error.code]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' · ');

    if (message) {
      console.warn('[support] countOpenSupportTickets:', message);
    }

    return 0;
  }

  return count ?? 0;
}

function mapTicketRow(
  row: TicketRow,
  profiles: Map<string, ProfileRow>,
): SupportTicket {
  const org = Array.isArray(row.client_orgs)
    ? row.client_orgs[0]
    : row.client_orgs;
  const website = Array.isArray(row.websites) ? row.websites[0] : row.websites;

  return {
    id: row.id,
    businessId: row.business_id ?? row.account_id ?? '',
    clientOrgId: row.client_org_id ?? null,
    websiteId: row.website_id ?? null,
    title: row.title ?? 'Untitled',
    description: row.description ?? null,
    status: (row.status as TicketStatus) ?? 'open',
    priority: (row.priority as TicketPriority) ?? 'medium',
    ticketNumber: row.ticket_number ?? 0,
    assignedTo: row.assigned_to ?? null,
    createdBy: row.created_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientOrgName: org?.name?.trim() ?? null,
    websiteName: website?.name?.trim() ?? null,
    websiteDomain: website?.domain ?? null,
    assignedToName: row.assigned_to
      ? (profiles.get(row.assigned_to)?.full_name?.trim() ?? null)
      : null,
    createdByName: row.created_by
      ? (profiles.get(row.created_by)?.full_name?.trim() ?? null)
      : null,
  };
}

export function createSupportTicketsService(client: SupabaseClient) {
  return new SupportTicketsService(client);
}

class SupportTicketsService {
  constructor(private readonly client: SupabaseClient) {}

  private get db(): SupabaseClient {
    return this.client;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const msg =
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(msg);
  }

  private async ensureUser() {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return user;
  }

  private async ensureCanView(accountId: string) {
    const user = await this.ensureUser();
    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) this.throwErr(error);
    const role = data?.account_role;
    if (!role || role === 'contractor' || role === 'client') {
      throw new Error('Permission denied');
    }

    return user;
  }

  private async loadProfiles(userIds: string[]) {
    const map = new Map<string, ProfileRow>();
    if (userIds.length === 0) return map;

    const { data } = await this.db
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    for (const row of (data ?? []) as ProfileRow[]) {
      map.set(row.id, row);
    }

    return map;
  }

  private async allocateTicketNumber(accountId: string) {
    const { data } = await this.db
      .from('support_tickets')
      .select('ticket_number')
      .or(supportTicketAccountFilter(accountId))
      .order('ticket_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (
      ((data as { ticket_number?: number | null } | null)?.ticket_number ?? 0) +
      1
    );
  }

  async listTickets(input: ListTicketsInput): Promise<SupportTicket[]> {
    await this.ensureCanView(input.accountId);

    let query = this.db
      .from('support_tickets')
      .select('*, client_orgs(name), websites(name, domain)')
      .or(supportTicketAccountFilter(input.accountId))
      .order('created_at', { ascending: false });

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.priority) {
      query = query.eq('priority', input.priority);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[support] listTickets:', error.message);
      return [];
    }

    const rows = (data ?? []) as TicketRow[];
    const userIds = [
      ...new Set(
        rows.flatMap((row) =>
          [row.assigned_to, row.created_by].filter(Boolean),
        ) as string[],
      ),
    ];
    const profiles = await this.loadProfiles(userIds);

    return rows.map((row) => mapTicketRow(row, profiles));
  }

  async getTicket(input: GetTicketInput): Promise<SupportTicket | null> {
    await this.ensureCanView(input.accountId);

    const { data, error } = await this.db
      .from('support_tickets')
      .select('*, client_orgs(name), websites(name, domain)')
      .eq('id', input.ticketId)
      .or(supportTicketAccountFilter(input.accountId))
      .maybeSingle();

    if (error || !data) return null;

    const row = data as TicketRow;
    const profiles = await this.loadProfiles(
      [row.assigned_to, row.created_by].filter(Boolean) as string[],
    );

    return mapTicketRow(row, profiles);
  }

  async listTicketMessages(
    accountId: string,
    ticketId: string,
  ): Promise<TicketMessage[]> {
    await this.ensureCanView(accountId);

    const ticket = await this.getTicket({ accountId, ticketId });
    if (!ticket) return [];

    const { data, error } = await this.db
      .from('ticket_messages')
      .select('id, ticket_id, user_id, message, is_internal, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[support] listTicketMessages:', error.message);
      return [];
    }

    const rows = (data ?? []) as MessageRow[];
    const profiles = await this.loadProfiles(rows.map((row) => row.user_id));

    return rows.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      message: row.message,
      isInternal: row.is_internal,
      createdAt: row.created_at,
      authorName: profiles.get(row.user_id)?.full_name?.trim() ?? null,
      authorAvatarUrl: profiles.get(row.user_id)?.avatar_url ?? null,
    }));
  }

  async listClientOrgs(accountId: string): Promise<ClientOrgOption[]> {
    await this.ensureCanView(accountId);

    const { data, error } = await this.db
      .from('client_orgs')
      .select('id, name')
      .or(supportTicketAccountFilter(accountId))
      .order('name');

    if (error) return [];

    return ((data ?? []) as { id: string; name?: string | null }[]).map(
      (row) => ({
        id: row.id,
        name: row.name?.trim() || 'Unnamed client',
      }),
    );
  }

  async listWebsitesForOrg(
    accountId: string,
    clientOrgId?: string | null,
  ): Promise<WebsiteOption[]> {
    await this.ensureCanView(accountId);

    let query = this.db
      .from('websites')
      .select('id, name, domain')
      .or(supportTicketAccountFilter(accountId))
      .order('name');

    if (clientOrgId) {
      query = query.eq('client_org_id', clientOrgId);
    }

    const { data, error } = await query;
    if (error) return [];

    return ((data ?? []) as WebsiteOption[]).map((row) => ({
      id: row.id,
      name: row.name?.trim() || 'Untitled',
      domain: row.domain ?? null,
    }));
  }

  async listTeamMembers(accountSlug: string): Promise<TeamMemberOption[]> {
    const { data, error } = await this.db.rpc('get_account_members', {
      account_slug: accountSlug,
    });

    if (error) {
      console.error('[support] listTeamMembers:', error.message);
      return [];
    }

    return ((data ?? []) as Array<{ user_id: string; name?: string | null }>)
      .map((row) => ({
        userId: row.user_id,
        name: row.name?.trim() || 'Team member',
      }))
      .filter((row) => row.userId);
  }

  async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const user = await this.ensureCanView(input.accountId);
    const ticketNumber = await this.allocateTicketNumber(input.accountId);

    const { data, error } = await this.db
      .from('support_tickets')
      .insert({
        business_id: input.accountId,
        account_id: input.accountId,
        title: input.title,
        description: input.description,
        client_org_id: input.client_org_id ?? null,
        website_id: input.website_id ?? null,
        priority: input.priority,
        status: 'open',
        ticket_number: ticketNumber,
        assigned_to: input.assigned_to ?? null,
        created_by: user.id,
      })
      .select('*, client_orgs(name), websites(name, domain)')
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to create ticket');
    }

    const ticket = data as TicketRow;

    await this.db.from('ticket_messages').insert({
      ticket_id: ticket.id,
      user_id: user.id,
      message: input.description,
      is_internal: false,
    });

    const profiles = await this.loadProfiles(
      [user.id, input.assigned_to].filter(Boolean) as string[],
    );
    return mapTicketRow(ticket, profiles);
  }

  async updateTicket(input: UpdateTicketInput): Promise<SupportTicket> {
    await this.ensureCanView(input.accountId);

    const updates: Record<string, unknown> = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.assigned_to !== undefined && {
        assigned_to: input.assigned_to,
      }),
      ...(input.client_org_id !== undefined && {
        client_org_id: input.client_org_id,
      }),
      ...(input.website_id !== undefined && { website_id: input.website_id }),
    };

    if (input.status === 'resolved' || input.status === 'closed') {
      updates.resolved_at = new Date().toISOString();
    } else if (input.status) {
      updates.resolved_at = null;
    }

    const { data, error } = await this.db
      .from('support_tickets')
      .update(updates)
      .eq('id', input.ticketId)
      .or(supportTicketAccountFilter(input.accountId))
      .select('*, client_orgs(name), websites(name, domain)')
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to update ticket');
    }

    const row = data as TicketRow;
    const profiles = await this.loadProfiles(
      [row.assigned_to, row.created_by].filter(Boolean) as string[],
    );

    return mapTicketRow(row, profiles);
  }

  async addTicketMessage(input: AddTicketMessageInput): Promise<TicketMessage> {
    const user = await this.ensureCanView(input.accountId);

    const ticket = await this.getTicket({
      accountId: input.accountId,
      ticketId: input.ticketId,
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const { data, error } = await this.db
      .from('ticket_messages')
      .insert({
        ticket_id: input.ticketId,
        user_id: user.id,
        message: input.message,
        is_internal: input.is_internal,
      })
      .select('id, ticket_id, user_id, message, is_internal, created_at')
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to add message');
    }

    const row = data as MessageRow;
    const profiles = await this.loadProfiles([user.id]);

    return {
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      message: row.message,
      isInternal: row.is_internal,
      createdAt: row.created_at,
      authorName: profiles.get(row.user_id)?.full_name?.trim() ?? null,
      authorAvatarUrl: profiles.get(row.user_id)?.avatar_url ?? null,
    };
  }
}
