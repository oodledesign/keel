import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  type WebsiteBrief,
  type WebsitePortalShareScope,
  type WebsiteSitemapPage,
  type WebsiteStyleSystem,
  type WebsiteWireframePage,
  emptyWebsiteStyleSystem,
  normalizeWebsiteBrief,
  wireframesForClientShare,
} from '~/lib/websites/planning-types';
import { migrateSitemapPages } from '~/lib/websites/sitemap-document';

import type {
  AddPortalTicketMessageInput,
  CreatePortalTicketInput,
  PortalTicketPriority,
  PortalTicketStatus,
} from '../schema/portal.schema';

export type PortalWebsite = {
  id: string;
  name: string;
  domain: string | null;
  status: string;
  stack: string | null;
  cmsAdminUrl: string | null;
  portalShareScope: WebsitePortalShareScope;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  style: WebsiteStyleSystem | null;
  brief: WebsiteBrief | null;
};

export type PortalSubscription = {
  id: string;
  planName: string;
  monthlyAmount: number | null;
  currency: string | null;
  status: string | null;
  nextBillingDate: string | null;
  stripePaymentLink: string | null;
};

export type PortalNotice = {
  id: string;
  title: string;
  content: string;
  itemType: string | null;
  createdAt: string;
};

export type PortalTicket = {
  id: string;
  title: string;
  status: PortalTicketStatus;
  priority: PortalTicketPriority;
  ticketNumber: number;
  createdAt: string;
};

export type PortalTicketDetail = PortalTicket & {
  description: string | null;
};

export type PortalTicketMessage = {
  id: string;
  ticketId: string;
  userId: string | null;
  message: string;
  createdAt: string;
  authorName: string | null;
  attachments: Array<{
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }>;
  externalUrl: string | null;
};

export type PortalProjectOption = {
  id: string;
  name: string;
};

export type PortalProjectSummary = {
  id: string;
  name: string;
  status: string | null;
  dueDate: string | null;
};

export type PortalProjectTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
};

export type PortalTaskComment = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export type PortalChatMessage = {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string | null;
  body: string;
  createdAt: string;
};

export type PortalInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  totalPence: number;
  currency: string | null;
  dueAt: string | null;
  paidAt: string | null;
  publicToken: string | null;
};

export type PortalOverviewData = {
  website: PortalWebsite | null;
  openTicketCount: number;
  subscription: PortalSubscription | null;
  notices: PortalNotice[];
};

export function createClientPortalService(client: SupabaseClient) {
  return new ClientPortalService(client);
}

class ClientPortalService {
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

  private async ensureMember(clientOrgId: string) {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');

    const { data: membership, error } = await this.db
      .from('client_members')
      .select('id')
      .eq('client_org_id', clientOrgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !membership) {
      throw new Error('Permission denied');
    }

    return user;
  }

  private async loadAuthorNames(userIds: string[]) {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;

    const unique = [...new Set(userIds)];
    const { data } = await this.db
      .from('profiles')
      .select('id, full_name')
      .in('id', unique);

    for (const row of (data ?? []) as Array<{
      id: string;
      full_name?: string | null;
    }>) {
      const name = row.full_name?.trim();
      if (name) map.set(row.id, name);
    }

    const missing = unique.filter((id) => !map.has(id));
    if (missing.length === 0) return map;

    const { data: accounts } = await this.db
      .from('accounts')
      .select('id, name, email')
      .in('id', missing);

    for (const row of (accounts ?? []) as Array<{
      id: string;
      name?: string | null;
      email?: string | null;
    }>) {
      const name = row.name?.trim() || row.email?.split('@')[0]?.trim() || null;
      if (name) map.set(row.id, name);
    }

    return map;
  }

  private async allocateTicketNumber(accountId: string) {
    const { allocateSupportTicketNumber } =
      await import('~/lib/support/allocate-support-ticket-number');
    return allocateSupportTicketNumber(this.db, accountId);
  }

  private mapWebsite(row: Record<string, unknown>): PortalWebsite {
    const portalScope = row.portal_share_scope;
    const scope: WebsitePortalShareScope =
      portalScope === 'sitemap' ||
      portalScope === 'wireframes' ||
      portalScope === 'full'
        ? portalScope
        : 'off';

    const allowPlanning = scope !== 'off';
    const allowWireframes = scope === 'wireframes' || scope === 'full';

    return {
      id: String(row.id),
      name: String(row.name ?? 'Website'),
      domain: (row.domain as string | null) ?? null,
      status: String(row.status ?? 'in-progress'),
      stack: (row.stack as string | null) ?? null,
      cmsAdminUrl: (row.cms_admin_url as string | null) ?? null,
      portalShareScope: scope,
      sitemap: allowPlanning ? migrateSitemapPages(row.sitemap) : [],
      wireframes:
        allowWireframes && Array.isArray(row.wireframes)
          ? wireframesForClientShare(row.wireframes as WebsiteWireframePage[])
          : [],
      style: null,
      brief: null,
    };
  }

  private async loadWebsiteBrief(
    websiteId: string,
    accountId: string,
  ): Promise<WebsiteBrief | null> {
    const { data } = await this.db
      .from('website_briefs')
      .select('brief')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!data?.brief || typeof data.brief !== 'object') return null;
    return normalizeWebsiteBrief(data.brief);
  }

  private async loadWebsiteStyle(
    websiteId: string,
    accountId: string,
  ): Promise<WebsiteStyleSystem | null> {
    const { data } = await this.db
      .from('website_style_systems')
      .select('style')
      .eq('website_id', websiteId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!data?.style || typeof data.style !== 'object') return null;

    const empty = emptyWebsiteStyleSystem();
    const stored = data.style as Partial<WebsiteStyleSystem>;
    return {
      tokens: { ...empty.tokens, ...(stored.tokens ?? {}) },
      moodboard: stored.moodboard ?? [],
      locked: Boolean(stored.locked),
    };
  }

  async getOverview(clientOrgId: string): Promise<PortalOverviewData> {
    await this.ensureMember(clientOrgId);

    const [
      websiteResult,
      ticketCountResult,
      subscriptionResult,
      noticesResult,
    ] = await Promise.all([
      this.db
        .from('websites')
        .select(
          'id, name, domain, status, stack, cms_admin_url, portal_share_scope, sitemap, wireframes, business_id',
        )
        .eq('client_org_id', clientOrgId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.db
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('client_org_id', clientOrgId)
        .in('status', ['open', 'in-progress', 'waiting']),
      this.db
        .from('client_subscriptions')
        .select(
          'id, plan_name, monthly_amount, currency, status, next_billing_date, stripe_payment_link',
        )
        .eq('client_org_id', clientOrgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.db
        .from('client_portal_items')
        .select('id, title, content, item_type, created_at')
        .eq('client_org_id', clientOrgId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false }),
    ]);

    const websiteRow = websiteResult.data as Record<string, unknown> | null;

    return {
      website: websiteRow ? this.mapWebsite(websiteRow) : null,
      openTicketCount: ticketCountResult.count ?? 0,
      subscription: subscriptionResult.data
        ? {
            id: subscriptionResult.data.id,
            planName:
              subscriptionResult.data.plan_name?.trim() || 'Subscription',
            monthlyAmount: subscriptionResult.data.monthly_amount ?? null,
            currency: subscriptionResult.data.currency ?? null,
            status: subscriptionResult.data.status ?? null,
            nextBillingDate: subscriptionResult.data.next_billing_date ?? null,
            stripePaymentLink:
              subscriptionResult.data.stripe_payment_link ?? null,
          }
        : null,
      notices: (
        (noticesResult.data ?? []) as Array<Record<string, unknown>>
      ).map((row) => ({
        id: String(row.id),
        title: String(row.title ?? 'Notice'),
        content: String(row.content ?? ''),
        itemType: (row.item_type as string | null) ?? null,
        createdAt: String(row.created_at),
      })),
    };
  }

  async getWebsite(clientOrgId: string): Promise<PortalWebsite | null> {
    await this.ensureMember(clientOrgId);

    const { data } = await this.db
      .from('websites')
      .select(
        'id, name, domain, status, stack, cms_admin_url, portal_share_scope, sitemap, wireframes, business_id',
      )
      .eq('client_org_id', clientOrgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const website = this.mapWebsite(data as Record<string, unknown>);

    if (website.portalShareScope !== 'off') {
      const accountId = String(
        (data as { business_id?: string }).business_id ?? '',
      );
      if (accountId) {
        const [brief, style] = await Promise.all([
          this.loadWebsiteBrief(website.id, accountId),
          website.portalShareScope === 'full'
            ? this.loadWebsiteStyle(website.id, accountId)
            : Promise.resolve(null),
        ]);
        website.brief = brief;
        website.style = style;
      }
    }

    return website;
  }

  async listTickets(
    clientOrgId: string,
    status?: PortalTicketStatus,
  ): Promise<PortalTicket[]> {
    await this.ensureMember(clientOrgId);

    let query = this.db
      .from('support_tickets')
      .select('id, title, status, priority, ticket_number, created_at')
      .eq('client_org_id', clientOrgId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[client-portal] listTickets:', error.message);
      return [];
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? 'Untitled'),
      status: (row.status as PortalTicketStatus) ?? 'open',
      priority: (row.priority as PortalTicketPriority) ?? 'medium',
      ticketNumber: Number(row.ticket_number ?? 0),
      createdAt: String(row.created_at),
    }));
  }

  async getTicket(
    clientOrgId: string,
    ticketId: string,
  ): Promise<PortalTicketDetail | null> {
    await this.ensureMember(clientOrgId);

    const { data, error } = await this.db
      .from('support_tickets')
      .select(
        'id, title, description, status, priority, ticket_number, created_at',
      )
      .eq('id', ticketId)
      .eq('client_org_id', clientOrgId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      title: data.title ?? 'Untitled',
      description: data.description ?? null,
      status: (data.status as PortalTicketStatus) ?? 'open',
      priority: (data.priority as PortalTicketPriority) ?? 'medium',
      ticketNumber: data.ticket_number ?? 0,
      createdAt: data.created_at,
    };
  }

  async listTicketMessages(
    clientOrgId: string,
    ticketId: string,
  ): Promise<PortalTicketMessage[]> {
    await this.ensureMember(clientOrgId);

    const ticket = await this.getTicket(clientOrgId, ticketId);
    if (!ticket) return [];

    const { data, error } = await this.db
      .from('ticket_messages')
      .select(
        'id, ticket_id, user_id, message, created_at, attachments, external_url, author_name',
      )
      .eq('ticket_id', ticketId)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    const rows = (data ?? []) as Array<{
      id: string;
      ticket_id: string;
      user_id: string | null;
      message: string;
      created_at: string;
      attachments?: unknown;
      external_url?: string | null;
      author_name?: string | null;
    }>;

    if ((error || rows.length === 0) && ticket.description?.trim()) {
      return [
        {
          id: `opening-${ticket.id}`,
          ticketId: ticket.id,
          userId: null,
          message: ticket.description,
          createdAt: ticket.createdAt,
          authorName: 'Client',
          attachments: [],
          externalUrl: null,
        },
      ];
    }

    if (error) {
      console.error('[client-portal] listTicketMessages:', error.message);
      return [];
    }

    const authors = await this.loadAuthorNames(
      rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)),
    );

    return rows.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      message: row.message,
      createdAt: row.created_at,
      authorName:
        row.author_name?.trim() ||
        (row.user_id ? (authors.get(row.user_id) ?? null) : null) ||
        'Support',
      attachments: Array.isArray(row.attachments)
        ? (row.attachments as PortalTicketMessage['attachments'])
        : [],
      externalUrl: row.external_url ?? null,
    }));
  }

  async listProjects(
    clientOrgId: string,
    accountId: string,
  ): Promise<PortalProjectOption[]> {
    await this.ensureMember(clientOrgId);

    const { data: clients } = await this.db
      .from('clients')
      .select('id')
      .eq('client_org_id', clientOrgId);

    const clientIds = (clients ?? []).map((row) => (row as { id: string }).id);
    if (clientIds.length === 0) return [];

    const { data, error } = await this.db
      .from('projects')
      .select('id, name, title')
      .eq('account_id', accountId)
      .in('client_id', clientIds)
      .order('updated_at', { ascending: false })
      .limit(50);

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

  /**
   * Projects the owning account has explicitly opted into the client portal
   * (projects.portal_visible = true). Relies on the additive
   * `projects_select_client_portal` RLS policy as the real authorization
   * boundary — ensureMember() only confirms portal membership.
   */
  async listPortalProjects(
    clientOrgId: string,
  ): Promise<PortalProjectSummary[]> {
    await this.ensureMember(clientOrgId);

    const { data, error } = await this.db
      .from('projects')
      .select('id, name, title, status, due_date')
      .eq('portal_visible', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[client-portal] listPortalProjects:', error.message);
      return [];
    }

    return (
      (data ?? []) as Array<{
        id: string;
        name?: string | null;
        title?: string | null;
        status?: string | null;
        due_date?: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name?.trim() || row.title?.trim() || 'Project',
      status: row.status ?? null,
      dueDate: row.due_date ?? null,
    }));
  }

  async getPortalProject(
    clientOrgId: string,
    projectId: string,
  ): Promise<PortalProjectSummary | null> {
    await this.ensureMember(clientOrgId);

    const { data, error } = await this.db
      .from('projects')
      .select('id, name, title, status, due_date')
      .eq('id', projectId)
      .eq('portal_visible', true)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name?.trim() || data.title?.trim() || 'Project',
      status: data.status ?? null,
      dueDate: data.due_date ?? null,
    };
  }

  async listPortalProjectTasks(
    clientOrgId: string,
    projectId: string,
  ): Promise<PortalProjectTask[]> {
    await this.ensureMember(clientOrgId);

    const { data, error } = await this.db
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[client-portal] listPortalProjectTasks:', error.message);
      return [];
    }

    return (
      (data ?? []) as Array<{
        id: string;
        title: string;
        status: string;
        priority: string | null;
        due_date: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status ?? 'todo',
      priority: row.priority,
      dueDate: row.due_date,
    }));
  }

  async listPortalTaskComments(
    clientOrgId: string,
    taskIds: string[],
  ): Promise<PortalTaskComment[]> {
    await this.ensureMember(clientOrgId);
    if (taskIds.length === 0) return [];

    // task_comments may lag generated Database types — same cast pattern
    // used by the guest-project board client component.
    const { data, error } = await (this.db as SupabaseClient)
      .from('task_comments')
      .select('id, task_id, author_id, body, created_at')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[client-portal] listPortalTaskComments:', error.message);
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      task_id: string;
      author_id: string;
      body: string;
      created_at: string;
    }>;

    const authors = await this.loadAuthorNames(
      rows.map((row) => row.author_id),
    );

    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      authorId: row.author_id,
      authorName: authors.get(row.author_id) ?? null,
      body: row.body,
      createdAt: row.created_at,
    }));
  }

  async addPortalTaskComment(
    clientOrgId: string,
    taskId: string,
    projectId: string,
    body: string,
  ): Promise<PortalTaskComment> {
    const user = await this.ensureMember(clientOrgId);

    // task_comments may lag generated Database types.
    const { data, error } = await (this.db as SupabaseClient)
      .from('task_comments')
      .insert({
        task_id: taskId,
        project_id: projectId,
        author_id: user.id,
        body,
      })
      .select('id, task_id, author_id, body, created_at')
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to add comment');
    }

    return {
      id: data.id,
      taskId: data.task_id,
      authorId: data.author_id,
      authorName: null,
      body: data.body,
      createdAt: data.created_at,
    };
  }

  async createTicket(
    input: CreatePortalTicketInput,
  ): Promise<PortalTicketDetail> {
    const user = await this.ensureMember(input.clientOrgId);
    const { data: org } = await this.db
      .from('client_orgs')
      .select('id, business_id, slug')
      .eq('id', input.clientOrgId)
      .maybeSingle();

    if (!org) {
      throw new Error('Client organisation not found');
    }

    const businessId = (org as { business_id?: string | null }).business_id;
    let accountId: string | null = null;

    if (businessId) {
      const { data: business } = await this.db
        .from('businesses')
        .select('account_id')
        .eq('id', businessId)
        .maybeSingle();
      accountId =
        (business as { account_id?: string | null } | null)?.account_id ??
        businessId;
    }

    if (!accountId) {
      throw new Error('Workspace not found for client');
    }

    if (input.project_id) {
      const projects = await this.listProjects(input.clientOrgId, accountId);
      if (!projects.some((project) => project.id === input.project_id)) {
        throw new Error('Invalid project for this client');
      }
    }

    const ticketNumber = await this.allocateTicketNumber(accountId);
    const now = new Date().toISOString();
    const { createSupportPublicToken } =
      await import('~/lib/support/support-tokens');

    const { data: profile } = await this.db
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const submitterName =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
      user.email?.split('@')[0] ||
      'Client';
    const submitterEmail = user.email?.toLowerCase() ?? null;

    const { data: account } = await this.db
      .from('accounts')
      .select('slug')
      .eq('id', accountId)
      .maybeSingle();
    const accountSlug =
      input.accountSlug?.trim() ||
      (account as { slug?: string | null } | null)?.slug ||
      null;

    const { data, error } = await this.db
      .from('support_tickets')
      .insert({
        business_id: accountId,
        account_id: accountId,
        client_org_id: input.clientOrgId,
        project_id: input.project_id ?? null,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: 'open',
        ticket_number: ticketNumber,
        created_by: user.id,
        public_token: createSupportPublicToken(),
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        recording_url: input.recording_url || null,
        external_url: input.external_url || null,
        last_activity_at: now,
      })
      .select(
        'id, title, description, status, priority, ticket_number, created_at, public_token, assigned_to',
      )
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to create ticket');
    }

    const { error: messageError } = await this.db
      .from('ticket_messages')
      .insert({
        ticket_id: data.id,
        user_id: user.id,
        message: input.description,
        is_internal: false,
        author_name: submitterName,
        author_email: submitterEmail,
        attachments: input.attachments ?? [],
        external_url: input.external_url || null,
      });

    if (messageError) {
      console.error(
        '[client-portal] opening message insert failed:',
        messageError.message,
      );
      throw new Error(
        messageError.message || 'Failed to save opening ticket message',
      );
    }

    if (accountSlug) {
      const { getSupabaseServerAdminClient } =
        await import('@kit/supabase/server-admin-client');
      const { notifyWorkspaceNewSupportTicket } =
        await import('~/lib/support/workspace-support-notifications');
      const admin = getSupabaseServerAdminClient();

      try {
        await notifyWorkspaceNewSupportTicket(admin, {
          accountId,
          accountSlug,
          ticketId: data.id as string,
          ticketNumber: Number(data.ticket_number),
          title: input.title,
          description: input.description,
          submitterName,
          submitterEmail,
          assignedTo:
            (data as { assigned_to?: string | null }).assigned_to ?? null,
          clientOrgSlug: (org as { slug?: string | null }).slug ?? null,
          publicToken:
            (data as { public_token?: string | null }).public_token ?? null,
          attachments: input.attachments ?? [],
        });
      } catch (err) {
        console.error('[client-portal] notify new ticket failed', err);
      }
    }

    return {
      id: data.id,
      title: data.title ?? 'Untitled',
      description: data.description ?? null,
      status: (data.status as PortalTicketStatus) ?? 'open',
      priority: (data.priority as PortalTicketPriority) ?? 'medium',
      ticketNumber: data.ticket_number ?? 0,
      createdAt: data.created_at,
    };
  }

  async addTicketMessage(
    input: AddPortalTicketMessageInput,
  ): Promise<PortalTicketMessage> {
    const user = await this.ensureMember(input.clientOrgId);

    const ticket = await this.getTicket(input.clientOrgId, input.ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const canReopen =
      ticket.status === 'resolved' ||
      ticket.status === 'closed' ||
      Boolean(input.reopen);

    if (ticket.status === 'closed' && !canReopen && !input.message.trim()) {
      throw new Error('This ticket is closed');
    }

    const { data: profile } = await this.db
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const authorName =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
      user.email?.split('@')[0] ||
      'Client';

    const { data, error } = await this.db
      .from('ticket_messages')
      .insert({
        ticket_id: input.ticketId,
        user_id: user.id,
        message: input.message,
        is_internal: false,
        author_name: authorName,
        author_email: user.email?.toLowerCase() ?? null,
        attachments: input.attachments ?? [],
        external_url: input.external_url || null,
      })
      .select(
        'id, ticket_id, user_id, message, created_at, attachments, external_url',
      )
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to send message');
    }

    const now = new Date().toISOString();
    let nextStatus = ticket.status;
    if (
      ticket.status === 'waiting' ||
      ticket.status === 'resolved' ||
      ticket.status === 'closed' ||
      input.reopen
    ) {
      nextStatus = 'open';
    }

    await this.db
      .from('support_tickets')
      .update({
        status: nextStatus,
        last_activity_at: now,
        updated_at: now,
        ...(nextStatus === 'open' ? { resolved_at: null } : {}),
      })
      .eq('id', input.ticketId);

    if (input.accountId && input.accountSlug) {
      const { getSupabaseServerAdminClient } =
        await import('@kit/supabase/server-admin-client');
      const { notifyWorkspaceSupportClientReply } =
        await import('~/lib/support/workspace-support-notifications');
      const admin = getSupabaseServerAdminClient();
      const { data: fullTicket } = await admin
        .from('support_tickets')
        .select('assigned_to, ticket_number, title, account_id, business_id')
        .eq('id', input.ticketId)
        .maybeSingle();

      const notifyAccountId =
        (fullTicket as { account_id?: string | null } | null)?.account_id ??
        (fullTicket as { business_id?: string | null } | null)?.business_id ??
        input.accountId;

      try {
        await notifyWorkspaceSupportClientReply(admin, {
          accountId: notifyAccountId,
          accountSlug: input.accountSlug,
          ticketId: input.ticketId,
          ticketNumber: Number(
            (fullTicket as { ticket_number?: number } | null)?.ticket_number ??
              ticket.ticketNumber,
          ),
          title:
            (fullTicket as { title?: string } | null)?.title ?? ticket.title,
          replyBody: input.message,
          assignedTo:
            (fullTicket as { assigned_to?: string | null } | null)
              ?.assigned_to ?? null,
          authorName,
          attachments: input.attachments ?? [],
        });
      } catch (err) {
        console.error('[client-portal] notify client reply failed', err);
      }
    }

    return {
      id: data.id,
      ticketId: data.ticket_id,
      userId: data.user_id,
      message: data.message,
      createdAt: data.created_at,
      authorName,
      attachments: Array.isArray(data.attachments)
        ? (data.attachments as PortalTicketMessage['attachments'])
        : [],
      externalUrl: data.external_url ?? null,
    };
  }

  async getBilling(clientOrgId: string): Promise<{
    subscription: PortalSubscription | null;
    invoices: PortalInvoice[];
  }> {
    await this.ensureMember(clientOrgId);

    const [subscriptionResult, clientsResult] = await Promise.all([
      this.db
        .from('client_subscriptions')
        .select(
          'id, plan_name, monthly_amount, currency, status, next_billing_date, stripe_payment_link',
        )
        .eq('client_org_id', clientOrgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.db.from('clients').select('id').eq('client_org_id', clientOrgId),
    ]);

    const subscription = subscriptionResult.data
      ? {
          id: subscriptionResult.data.id,
          planName: subscriptionResult.data.plan_name?.trim() || 'Subscription',
          monthlyAmount: subscriptionResult.data.monthly_amount ?? null,
          currency: subscriptionResult.data.currency ?? null,
          status: subscriptionResult.data.status ?? null,
          nextBillingDate: subscriptionResult.data.next_billing_date ?? null,
          stripePaymentLink:
            subscriptionResult.data.stripe_payment_link ?? null,
        }
      : null;

    const clientIds = ((clientsResult.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    if (clientIds.length === 0) {
      return { subscription, invoices: [] };
    }

    const { data: invoices } = await this.db
      .from('invoices')
      .select(
        'id, invoice_number, status, total_pence, currency, due_at, paid_at, public_token',
      )
      .in('client_id', clientIds)
      .order('due_at', { ascending: false });

    return {
      subscription,
      invoices: ((invoices ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({
          id: String(row.id),
          invoiceNumber: (row.invoice_number as string | null) ?? null,
          status: String(row.status ?? 'draft'),
          totalPence: Number(row.total_pence ?? 0),
          currency: (row.currency as string | null) ?? null,
          dueAt: (row.due_at as string | null) ?? null,
          paidAt: (row.paid_at as string | null) ?? null,
          publicToken: (row.public_token as string | null) ?? null,
        }),
      ),
    };
  }

  /**
   * Returns the single per-org client-portal chat thread id, creating it on
   * first use. Delegates to a SECURITY DEFINER RPC because neither a bare
   * portal contact nor a bare team member can satisfy chat_threads_insert
   * alone — see 20260911091600_client_portal_messages_thread.sql.
   */
  async getOrCreateMessageThread(clientOrgId: string): Promise<string> {
    await this.ensureMember(clientOrgId);

    const { data, error } = await this.db.rpc(
      'get_or_create_client_portal_thread',
      { p_client_org_id: clientOrgId },
    );

    if (error || !data) {
      this.throwErr(error, 'Could not open messages');
    }

    return data as string;
  }

  async listPortalMessages(
    clientOrgId: string,
    threadId: string,
  ): Promise<PortalChatMessage[]> {
    await this.ensureMember(clientOrgId);

    const { data, error } = await this.db
      .from('chat_messages')
      .select('id, thread_id, sender_user_id, body, created_at')
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('[client-portal] listPortalMessages:', error.message);
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      thread_id: string;
      sender_user_id: string;
      body: string;
      created_at: string;
    }>;

    const senders = await this.loadAuthorNames(
      rows.map((row) => row.sender_user_id),
    );

    return rows.map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      senderUserId: row.sender_user_id,
      senderName: senders.get(row.sender_user_id) ?? null,
      body: row.body,
      createdAt: row.created_at,
    }));
  }

  async sendPortalMessage(
    clientOrgId: string,
    threadId: string,
    body: string,
  ): Promise<PortalChatMessage> {
    const user = await this.ensureMember(clientOrgId);

    const { data, error } = await this.db
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_user_id: user.id,
        body,
      })
      .select('id, thread_id, sender_user_id, body, created_at')
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to send message');
    }

    return {
      id: data.id,
      threadId: data.thread_id,
      senderUserId: data.sender_user_id,
      senderName: null,
      body: data.body,
      createdAt: data.created_at,
    };
  }
}
