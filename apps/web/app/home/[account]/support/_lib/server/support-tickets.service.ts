import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  loadClientPicturesByOrgIds,
  loadSupportBusinessBrand,
} from '~/lib/support/support-party-branding';

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
  projectId: string | null;
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
  lastActivityAt: string | null;
  requestTypeId: string | null;
  creditCostSnapshot: number | null;
  creditsDeductedAt: string | null;
  clientOrgName: string | null;
  clientPictureUrl: string | null;
  businessName: string | null;
  businessLogoUrl: string | null;
  websiteName: string | null;
  websiteDomain: string | null;
  projectName: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  recordingUrl: string | null;
  externalUrl: string | null;
  publicToken: string | null;
  assignedToName: string | null;
  createdByName: string | null;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  userId: string | null;
  message: string;
  isInternal: boolean;
  createdAt: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  attachments: Array<{
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }>;
  externalUrl: string | null;
};

export type ClientOrgOption = {
  id: string;
  name: string;
  slug?: string | null;
};
export type WebsiteOption = { id: string; name: string; domain: string | null };
export type ProjectOption = { id: string; name: string };
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
  project_id?: string | null;
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
  last_activity_at?: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  recording_url?: string | null;
  external_url?: string | null;
  public_token?: string | null;
  request_type_id?: string | null;
  credit_cost_snapshot?: number | null;
  credits_deducted_at?: string | null;
  client_orgs?:
    | { name?: string | null; slug?: string | null }
    | { name?: string | null; slug?: string | null }[]
    | null;
  websites?:
    | { name?: string | null; domain?: string | null }
    | Array<{
        name?: string | null;
        domain?: string | null;
      }>
    | null;
  projects?:
    | { name?: string | null; title?: string | null }
    | Array<{ name?: string | null; title?: string | null }>
    | null;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  user_id: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
  attachments?: unknown;
  external_url?: string | null;
  author_name?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

function supportTicketAccountFilter(accountId: string) {
  return `business_id.eq.${accountId},account_id.eq.${accountId}`;
}

/**
 * Tickets that need agency attention: new or reopened after a client reply.
 * (`waiting` means waiting on the client after an agency reply.)
 */
export async function countOpenSupportTickets(
  client: SupabaseClient,
  accountId: string,
) {
  const { count, error } = await client
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .or(supportTicketAccountFilter(accountId))
    .eq('status', 'open');

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
  branding?: {
    clientPictureUrl?: string | null;
    businessName?: string | null;
    businessLogoUrl?: string | null;
  },
): SupportTicket {
  const org = Array.isArray(row.client_orgs)
    ? row.client_orgs[0]
    : row.client_orgs;
  const website = Array.isArray(row.websites) ? row.websites[0] : row.websites;
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;

  return {
    id: row.id,
    businessId: row.business_id ?? row.account_id ?? '',
    clientOrgId: row.client_org_id ?? null,
    websiteId: row.website_id ?? null,
    projectId: row.project_id ?? null,
    title: row.title ?? 'Untitled',
    description: row.description ?? null,
    status: (() => {
      const raw = row.status ?? 'open';
      if (raw === 'in_progress') return 'in-progress';
      if (raw === 'awaiting_client') return 'waiting';
      return (raw as TicketStatus) ?? 'open';
    })(),
    priority: (row.priority as TicketPriority) ?? 'medium',
    ticketNumber: row.ticket_number ?? 0,
    assignedTo: row.assigned_to ?? null,
    createdBy: row.created_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at ?? row.updated_at ?? null,
    clientOrgName: org?.name?.trim() ?? null,
    clientPictureUrl: branding?.clientPictureUrl ?? null,
    businessName: branding?.businessName ?? null,
    businessLogoUrl: branding?.businessLogoUrl ?? null,
    websiteName: website?.name?.trim() ?? null,
    websiteDomain: website?.domain ?? null,
    projectName: project?.name?.trim() || project?.title?.trim() || null,
    submitterName: row.submitter_name?.trim() ?? null,
    submitterEmail: row.submitter_email?.trim() ?? null,
    recordingUrl: row.recording_url ?? null,
    externalUrl: row.external_url ?? null,
    publicToken: row.public_token ?? null,
    requestTypeId: row.request_type_id ?? null,
    creditCostSnapshot:
      typeof row.credit_cost_snapshot === 'number'
        ? row.credit_cost_snapshot
        : null,
    creditsDeductedAt: row.credits_deducted_at ?? null,
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

  /** Best-effort display name for a user (profile → account → email). */
  private async resolveAuthorName(
    userId: string,
    email?: string | null,
  ): Promise<string> {
    const profiles = await this.loadProfiles([userId]);
    const fromProfile = profiles.get(userId)?.full_name?.trim();
    if (fromProfile) return fromProfile;

    const { data: account } = await this.db
      .from('accounts')
      .select('name, email')
      .eq('id', userId)
      .maybeSingle();

    const fromAccount =
      (account as { name?: string | null } | null)?.name?.trim() ||
      (account as { email?: string | null } | null)?.email
        ?.split('@')[0]
        ?.trim();
    if (fromAccount) return fromAccount;

    const fromEmail = email?.split('@')[0]?.trim();
    if (fromEmail) return fromEmail;

    return 'Support';
  }

  private async allocateTicketNumber(accountId: string) {
    const { allocateSupportTicketNumber } =
      await import('~/lib/support/allocate-support-ticket-number');
    return allocateSupportTicketNumber(this.db, accountId);
  }

  async listTickets(input: ListTicketsInput): Promise<SupportTicket[]> {
    await this.ensureCanView(input.accountId);

    let query = this.db
      .from('support_tickets')
      .select(
        '*, client_orgs(name, slug), websites(name, domain), projects!support_tickets_project_id_fkey(name, title)',
      )
      .or(supportTicketAccountFilter(input.accountId))
      .order('last_activity_at', { ascending: false });

    if (input.status) {
      query = query.eq('status', input.status);
    }

    if (input.priority) {
      query = query.eq('priority', input.priority);
    }

    if (input.projectId) {
      query = query.eq('project_id', input.projectId);
    }

    if (input.clientOrgId) {
      query = query.eq('client_org_id', input.clientOrgId);
    }

    if (input.q?.trim()) {
      const raw = input.q
        .trim()
        .replace(/[%_,.()]/g, ' ')
        .slice(0, 80);
      const q = `%${raw}%`;
      query = query.or(`title.ilike.${q},description.ilike.${q}`);
    }

    let { data, error } = await query;
    if (error) {
      // Fallback if the project FK hint isn't available in older DBs.
      console.warn(
        '[support] listTickets with project FK failed, retrying:',
        error.message,
      );
      let fallback = this.db
        .from('support_tickets')
        .select('*, client_orgs(name, slug), websites(name, domain)')
        .or(supportTicketAccountFilter(input.accountId))
        .order('last_activity_at', { ascending: false });

      if (input.status) fallback = fallback.eq('status', input.status);
      if (input.priority) fallback = fallback.eq('priority', input.priority);
      if (input.projectId)
        fallback = fallback.eq('project_id', input.projectId);
      if (input.clientOrgId) {
        fallback = fallback.eq('client_org_id', input.clientOrgId);
      }
      if (input.q?.trim()) {
        const raw = input.q
          .trim()
          .replace(/[%_,.()]/g, ' ')
          .slice(0, 80);
        const q = `%${raw}%`;
        fallback = fallback.or(`title.ilike.${q},description.ilike.${q}`);
      }

      const retry = await fallback;
      data = retry.data;
      error = retry.error;
    }

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
    const [clientPictures, businessBrand] = await Promise.all([
      loadClientPicturesByOrgIds(
        this.db,
        rows
          .map((row) => row.client_org_id)
          .filter((id): id is string => Boolean(id)),
      ),
      loadSupportBusinessBrand(input.accountId),
    ]);

    return rows.map((row) =>
      mapTicketRow(row, profiles, {
        clientPictureUrl: row.client_org_id
          ? (clientPictures.get(row.client_org_id) ?? null)
          : null,
        businessName: businessBrand.name,
        businessLogoUrl: businessBrand.logoUrl,
      }),
    );
  }

  async getTicket(input: GetTicketInput): Promise<SupportTicket | null> {
    await this.ensureCanView(input.accountId);

    const { data, error } = await this.db
      .from('support_tickets')
      .select(
        '*, client_orgs(name, slug), websites(name, domain), projects(name, title)',
      )
      .eq('id', input.ticketId)
      .or(supportTicketAccountFilter(input.accountId))
      .maybeSingle();

    if (error || !data) return null;

    const row = data as TicketRow;
    const profiles = await this.loadProfiles(
      [row.assigned_to, row.created_by].filter(Boolean) as string[],
    );
    const [clientPictures, businessBrand] = await Promise.all([
      loadClientPicturesByOrgIds(
        this.db,
        row.client_org_id ? [row.client_org_id] : [],
      ),
      loadSupportBusinessBrand(input.accountId),
    ]);

    return mapTicketRow(row, profiles, {
      clientPictureUrl: row.client_org_id
        ? (clientPictures.get(row.client_org_id) ?? null)
        : null,
      businessName: businessBrand.name,
      businessLogoUrl: businessBrand.logoUrl,
    });
  }

  async listTicketMessages(
    accountId: string,
    ticketId: string,
  ): Promise<TicketMessage[]> {
    await this.ensureCanView(accountId);

    const ticket = await this.getTicket({ accountId, ticketId });
    if (!ticket) return [];

    const { getSupabaseServerAdminClient } =
      await import('@kit/supabase/server-admin-client');
    const admin = getSupabaseServerAdminClient();

    const { data, error } = await admin
      .from('ticket_messages')
      .select(
        'id, ticket_id, user_id, message, is_internal, created_at, attachments, external_url, author_name',
      )
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[support] listTicketMessages:', error.message);
    }

    const rows = (
      error ? [] : ((data ?? []) as unknown as MessageRow[])
    ).filter((row) => Boolean(row.message?.trim()));

    if (rows.length === 0 && ticket.description?.trim()) {
      return [
        {
          id: `opening-${ticket.id}`,
          ticketId: ticket.id,
          userId: ticket.createdBy,
          message: ticket.description,
          isInternal: false,
          createdAt: ticket.createdAt,
          authorName:
            ticket.submitterName?.trim() ||
            ticket.createdByName?.trim() ||
            'Client',
          authorAvatarUrl: null,
          attachments: [],
          externalUrl: ticket.externalUrl,
        },
      ];
    }

    const userIds = rows
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id));
    const profiles = await this.loadProfiles(userIds);
    const authorNames = new Map<string, string>();

    for (const id of userIds) {
      const fromProfile = profiles.get(id)?.full_name?.trim();
      if (fromProfile) authorNames.set(id, fromProfile);
    }

    const missing = [...new Set(userIds)].filter((id) => !authorNames.has(id));
    if (missing.length > 0) {
      const { data: accounts } = await this.db
        .from('accounts')
        .select('id, name, email')
        .in('id', missing);

      for (const row of (accounts ?? []) as Array<{
        id: string;
        name?: string | null;
        email?: string | null;
      }>) {
        const name =
          row.name?.trim() || row.email?.split('@')[0]?.trim() || null;
        if (name) authorNames.set(row.id, name);
      }
    }

    return rows.map((row) => {
      const resolvedName =
        row.author_name?.trim() ||
        (row.user_id ? authorNames.get(row.user_id) : undefined) ||
        null;

      return {
        id: row.id,
        ticketId: row.ticket_id,
        userId: row.user_id,
        message: row.message,
        isInternal: row.is_internal,
        createdAt: row.created_at,
        authorName:
          resolvedName ||
          (!row.user_id
            ? ticket.submitterName?.trim() || 'Client'
            : row.is_internal
              ? 'Support'
              : ticket.submitterName?.trim() || 'Client'),
        authorAvatarUrl: row.user_id
          ? (profiles.get(row.user_id)?.avatar_url ?? null)
          : null,
        attachments: Array.isArray(row.attachments)
          ? (row.attachments as TicketMessage['attachments'])
          : [],
        externalUrl: row.external_url ?? null,
      };
    });
  }

  async listClientOrgs(accountId: string): Promise<ClientOrgOption[]> {
    await this.ensureCanView(accountId);

    const { data: businesses } = await this.db
      .from('businesses')
      .select('id')
      .eq('account_id', accountId);
    const businessIds = (businesses ?? []).map(
      (row) => (row as { id: string }).id,
    );

    let query = this.db
      .from('client_orgs')
      .select('id, name, slug')
      .eq('business_id', accountId)
      .order('name');

    if (businessIds.length > 0) {
      query = this.db
        .from('client_orgs')
        .select('id, name, slug')
        .or(
          `business_id.eq.${accountId},business_id.in.(${businessIds.join(',')})`,
        )
        .order('name');
    }

    const { data, error } = await query;
    if (error) {
      console.error('[support] listClientOrgs:', error.message);
      return [];
    }

    return (
      (data ?? []) as {
        id: string;
        name?: string | null;
        slug?: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name?.trim() || 'Unnamed client',
      slug: row.slug ?? null,
    }));
  }

  async listWebsitesForOrg(
    accountId: string,
    clientOrgId?: string | null,
  ): Promise<WebsiteOption[]> {
    await this.ensureCanView(accountId);

    let query = this.db
      .from('websites')
      .select('id, name, domain')
      .eq('business_id', accountId)
      .order('name');

    // Also try account-scoped filter via business resolution below if empty
    if (clientOrgId) {
      query = query.eq('client_org_id', clientOrgId);
    }

    let { data, error } = await query;

    if (error || !(data ?? []).length) {
      const { data: businesses } = await this.db
        .from('businesses')
        .select('id')
        .eq('account_id', accountId);
      const businessIds = (businesses ?? []).map(
        (row) => (row as { id: string }).id,
      );
      if (businessIds.length > 0) {
        let fallback = this.db
          .from('websites')
          .select('id, name, domain')
          .in('business_id', businessIds)
          .order('name');
        if (clientOrgId) {
          fallback = fallback.eq('client_org_id', clientOrgId);
        }
        const result = await fallback;
        data = result.data;
        error = result.error;
      }
    }

    if (error) return [];

    return ((data ?? []) as WebsiteOption[]).map((row) => ({
      id: row.id,
      name: row.name?.trim() || 'Untitled',
      domain: row.domain ?? null,
    }));
  }

  async listProjectsForOrg(
    accountId: string,
    clientOrgId?: string | null,
  ): Promise<ProjectOption[]> {
    await this.ensureCanView(accountId);

    let clientIds: string[] | null = null;
    if (clientOrgId) {
      const { data: clients } = await this.db
        .from('clients')
        .select('id')
        .eq('client_org_id', clientOrgId);
      clientIds = (clients ?? []).map((row) => (row as { id: string }).id);
      if (clientIds.length === 0) return [];
    }

    let query = this.db
      .from('projects')
      .select('id, name, title')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (clientIds) {
      query = query.in('client_id', clientIds);
    }

    const { data, error } = await query;
    if (error) return [];

    return (
      (data ?? []) as Array<{
        id: string;
        name?: string | null;
        title?: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name?.trim() || row.title?.trim() || 'Project',
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
    const now = new Date().toISOString();
    const { createSupportPublicToken } =
      await import('~/lib/support/support-tokens');
    const { resolveRequestTypeCreditSnapshot } =
      await import('~/lib/credits/ticket-credit-lifecycle');

    const creditSnapshot = await resolveRequestTypeCreditSnapshot({
      accountId: input.accountId,
      requestTypeId: input.request_type_id,
    });

    const { data, error } = await this.db
      .from('support_tickets')
      .insert({
        business_id: input.accountId,
        account_id: input.accountId,
        title: input.title,
        description: input.description,
        client_org_id: input.client_org_id ?? null,
        website_id: input.website_id ?? null,
        project_id: input.project_id ?? null,
        recording_url: input.recording_url || null,
        external_url: input.external_url || null,
        priority: input.priority,
        status: 'open',
        ticket_number: ticketNumber,
        assigned_to: input.assigned_to ?? null,
        created_by: user.id,
        public_token: createSupportPublicToken(),
        last_activity_at: now,
        request_type_id: creditSnapshot.requestTypeId,
        credit_cost_snapshot: creditSnapshot.creditCostSnapshot,
      })
      .select(
        '*, client_orgs(name, slug), websites(name, domain), projects(name, title)',
      )
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to create ticket');
    }

    const ticket = data as TicketRow;

    {
      const { getSupabaseServerAdminClient } =
        await import('@kit/supabase/server-admin-client');
      const admin = getSupabaseServerAdminClient();
      const authorName = await this.resolveAuthorName(user.id, user.email);
      // ticket_messages columns may lag generated Database types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: messageError } = await (admin as any)
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: input.description,
          is_internal: false,
          author_name: authorName,
          attachments: input.attachments ?? [],
        });

      if (messageError) {
        console.error(
          '[support] opening message insert failed:',
          messageError.message,
        );
        throw new Error(
          messageError.message || 'Failed to save opening ticket message',
        );
      }
    }

    if (input.accountSlug) {
      const { getSupabaseServerAdminClient } =
        await import('@kit/supabase/server-admin-client');
      const { notifyWorkspaceNewSupportTicket } =
        await import('~/lib/support/workspace-support-notifications');
      const admin = getSupabaseServerAdminClient();
      const org = Array.isArray(ticket.client_orgs)
        ? ticket.client_orgs[0]
        : ticket.client_orgs;

      try {
        await notifyWorkspaceNewSupportTicket(admin, {
          accountId: input.accountId,
          accountSlug: input.accountSlug,
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number ?? ticketNumber,
          title: input.title,
          description: input.description,
          submitterName: null,
          submitterEmail: null,
          assignedTo: input.assigned_to ?? null,
          clientOrgSlug: org?.slug ?? null,
          publicToken: ticket.public_token ?? null,
          attachments: input.attachments ?? [],
        });
      } catch (err) {
        console.error('[support] notify new ticket failed', err);
      }
    }

    const profiles = await this.loadProfiles(
      [user.id, input.assigned_to].filter(Boolean) as string[],
    );
    return this.enrichTicketBranding(
      input.accountId,
      mapTicketRow(ticket, profiles),
    );
  }

  async updateTicket(input: UpdateTicketInput): Promise<SupportTicket> {
    const user = await this.ensureCanView(input.accountId);

    const existing = await this.getTicket({
      accountId: input.accountId,
      ticketId: input.ticketId,
    });
    if (!existing) {
      throw new Error('Ticket not found');
    }

    let nextStatus = input.status;

    if (input.status === 'in-progress') {
      const { tryConsumeCreditsForTicketWorkStart } =
        await import('~/lib/credits/ticket-credit-lifecycle');
      const consume = await tryConsumeCreditsForTicketWorkStart({
        accountId: input.accountId,
        ticketId: input.ticketId,
        actorId: user.id,
      });

      if (!consume.ok) {
        nextStatus = 'pending_credits';
        const { data: held, error: holdError } = await this.db
          .from('support_tickets')
          .update({
            status: 'pending_credits',
            resolved_at: null,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', input.ticketId)
          .or(supportTicketAccountFilter(input.accountId))
          .select(
            '*, client_orgs(name, slug), websites(name, domain), projects(name, title)',
          )
          .single();

        if (holdError || !held) {
          this.throwErr(holdError, 'Failed to hold ticket for credits');
        }

        const heldRow = held as TicketRow;
        const profiles = await this.loadProfiles(
          [heldRow.assigned_to, heldRow.created_by].filter(Boolean) as string[],
        );

        const ticket = await this.enrichTicketBranding(
          input.accountId,
          mapTicketRow(heldRow, profiles),
        );

        throw Object.assign(
          new Error(
            `Insufficient credits (${consume.available} available, ${consume.requested} required). Ticket held as Pending credits.`,
          ),
          { code: 'insufficient_balance', ticket },
        );
      }
    }

    if (input.status === 'closed') {
      const { refundCreditsIfTicketCancelled } =
        await import('~/lib/credits/ticket-credit-lifecycle');
      await refundCreditsIfTicketCancelled({
        accountId: input.accountId,
        ticketId: input.ticketId,
        previousStatus: existing.status,
        actorId: user.id,
      });
    }

    const updates: Record<string, unknown> = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(nextStatus !== undefined && { status: nextStatus }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.assigned_to !== undefined && {
        assigned_to: input.assigned_to,
      }),
      ...(input.client_org_id !== undefined && {
        client_org_id: input.client_org_id,
      }),
      ...(input.website_id !== undefined && { website_id: input.website_id }),
      ...(input.project_id !== undefined && { project_id: input.project_id }),
      last_activity_at: new Date().toISOString(),
    };

    if (nextStatus === 'resolved' || nextStatus === 'closed') {
      updates.resolved_at = new Date().toISOString();
    } else if (nextStatus) {
      updates.resolved_at = null;
    }

    const { data, error } = await this.db
      .from('support_tickets')
      .update(updates)
      .eq('id', input.ticketId)
      .or(supportTicketAccountFilter(input.accountId))
      .select(
        '*, client_orgs(name, slug), websites(name, domain), projects(name, title)',
      )
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to update ticket');
    }

    const row = data as TicketRow;
    const profiles = await this.loadProfiles(
      [row.assigned_to, row.created_by].filter(Boolean) as string[],
    );

    return this.enrichTicketBranding(
      input.accountId,
      mapTicketRow(row, profiles),
    );
  }

  private async enrichTicketBranding(
    accountId: string,
    ticket: SupportTicket,
  ): Promise<SupportTicket> {
    const [clientPictures, businessBrand] = await Promise.all([
      loadClientPicturesByOrgIds(
        this.db,
        ticket.clientOrgId ? [ticket.clientOrgId] : [],
      ),
      loadSupportBusinessBrand(accountId),
    ]);

    return {
      ...ticket,
      clientPictureUrl: ticket.clientOrgId
        ? (clientPictures.get(ticket.clientOrgId) ?? null)
        : null,
      businessName: businessBrand.name,
      businessLogoUrl: businessBrand.logoUrl,
    };
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

    const authorName = await this.resolveAuthorName(user.id, user.email);

    const { data, error } = await this.db
      .from('ticket_messages')
      .insert({
        ticket_id: input.ticketId,
        user_id: user.id,
        message: input.message,
        is_internal: input.is_internal,
        author_name: authorName,
        attachments: input.attachments ?? [],
        external_url: input.external_url || null,
      })
      .select(
        'id, ticket_id, user_id, message, is_internal, created_at, attachments, external_url, author_name',
      )
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to add message');
    }

    const now = new Date().toISOString();
    const nextStatus = !input.is_internal
      ? ticket.status === 'open'
        ? 'waiting'
        : ticket.status
      : ticket.status;

    await this.db
      .from('support_tickets')
      .update({
        last_activity_at: now,
        updated_at: now,
        status: nextStatus,
      })
      .eq('id', input.ticketId);

    if (!input.is_internal && input.accountSlug) {
      const { getSupabaseServerAdminClient } =
        await import('@kit/supabase/server-admin-client');
      const { notifyWorkspaceSupportAgencyReply } =
        await import('~/lib/support/workspace-support-notifications');
      const admin = getSupabaseServerAdminClient();

      let clientOrgSlug: string | null = null;
      if (ticket.clientOrgId) {
        const { data: org } = await admin
          .from('client_orgs')
          .select('slug')
          .eq('id', ticket.clientOrgId)
          .maybeSingle();
        clientOrgSlug = (org as { slug?: string | null } | null)?.slug ?? null;
      }

      try {
        await notifyWorkspaceSupportAgencyReply(admin, {
          accountId: input.accountId,
          accountSlug: input.accountSlug,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          replyBody: input.message,
          clientOrgId: ticket.clientOrgId,
          clientOrgSlug,
          submitterEmail: ticket.submitterEmail,
          publicToken: ticket.publicToken,
          attachments: input.attachments ?? [],
        });
      } catch (err) {
        console.error('[support] notify agency reply failed', err);
      }
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
      authorName: row.author_name?.trim() || authorName,
      authorAvatarUrl: profiles.get(user.id)?.avatar_url ?? null,
      attachments: Array.isArray(row.attachments)
        ? (row.attachments as TicketMessage['attachments'])
        : [],
      externalUrl: row.external_url ?? null,
    };
  }
}
