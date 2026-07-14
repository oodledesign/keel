import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  emptyWebsiteStyleSystem,
  normalizeWebsiteBrief,
  type WebsiteBrief,
  type WebsitePortalShareScope,
  type WebsiteSitemapPage,
  type WebsiteStyleSystem,
  type WebsiteWireframePage,
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
  userId: string;
  message: string;
  createdAt: string;
  authorName: string | null;
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

    const { data } = await this.db
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    for (const row of (data ?? []) as Array<{
      id: string;
      full_name?: string | null;
    }>) {
      map.set(row.id, row.full_name?.trim() || 'Team member');
    }

    return map;
  }

  private async allocateTicketNumber(accountId: string) {
    const { data } = await this.db
      .from('support_tickets')
      .select('ticket_number')
      .eq('business_id', accountId)
      .order('ticket_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    return ((data as { ticket_number?: number | null } | null)?.ticket_number ??
      0) + 1;
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

    const [websiteResult, ticketCountResult, subscriptionResult, noticesResult] =
      await Promise.all([
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
      notices: ((noticesResult.data ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({
          id: String(row.id),
          title: String(row.title ?? 'Notice'),
          content: String(row.content ?? ''),
          itemType: (row.item_type as string | null) ?? null,
          createdAt: String(row.created_at),
        }),
      ),
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
      .select('id, ticket_id, user_id, message, created_at')
      .eq('ticket_id', ticketId)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[client-portal] listTicketMessages:', error.message);
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      ticket_id: string;
      user_id: string;
      message: string;
      created_at: string;
    }>;

    const authors = await this.loadAuthorNames(rows.map((row) => row.user_id));

    return rows.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      message: row.message,
      createdAt: row.created_at,
      authorName: authors.get(row.user_id) ?? null,
    }));
  }

  async createTicket(input: CreatePortalTicketInput): Promise<PortalTicketDetail> {
    const user = await this.ensureMember(input.clientOrgId);
    const ticketNumber = await this.allocateTicketNumber(input.accountId);

    const { data, error } = await this.db
      .from('support_tickets')
      .insert({
        business_id: input.accountId,
        client_org_id: input.clientOrgId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: 'open',
        ticket_number: ticketNumber,
        created_by: user.id,
      })
      .select(
        'id, title, description, status, priority, ticket_number, created_at',
      )
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to create ticket');
    }

    await this.db.from('ticket_messages').insert({
      ticket_id: data.id,
      user_id: user.id,
      message: input.description,
      is_internal: false,
    });

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

    const { data, error } = await this.db
      .from('ticket_messages')
      .insert({
        ticket_id: input.ticketId,
        user_id: user.id,
        message: input.message,
        is_internal: false,
      })
      .select('id, ticket_id, user_id, message, created_at')
      .single();

    if (error || !data) {
      this.throwErr(error, 'Failed to send message');
    }

    const authors = await this.loadAuthorNames([user.id]);

    return {
      id: data.id,
      ticketId: data.ticket_id,
      userId: data.user_id,
      message: data.message,
      createdAt: data.created_at,
      authorName: authors.get(user.id) ?? null,
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
          planName:
            subscriptionResult.data.plan_name?.trim() || 'Subscription',
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
}
