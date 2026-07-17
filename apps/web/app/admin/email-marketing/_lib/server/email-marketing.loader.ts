import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import type { EmailCampaignRow } from '~/lib/admin-email/campaigns';
import {
  type EmailRecipientList,
  type RecipientListMember,
  type RecipientListSummary,
  loadCustomContactLists,
  loadRecipientListsOverview,
} from '~/lib/admin-email/campaigns';

type DbClient = {
  from: (table: string) => any;
  auth: {
    admin: {
      listUsers: (params: { page?: number; perPage?: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string }> };
        error: { message: string } | null;
      }>;
    };
  };
};

function adminClient() {
  return getSupabaseServerAdminClient() as unknown as DbClient;
}

export type EmailContactRow = {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  email: string;
  trade: string | null;
  source: string | null;
  notes: string | null;
  subscribed: boolean;
  has_signed_up?: boolean;
};

export type EmailUnsubscribeRow = {
  id: string;
  email: string;
  user_id: string | null;
  contact_id: string | null;
  unsubscribed_at: string;
  reason: string | null;
};

export type CampaignListRow = EmailCampaignRow & {
  open_rate: number;
  click_rate: number;
  unique_opens: number;
  unique_clicks: number;
};

export async function loadCampaigns(): Promise<CampaignListRow[]> {
  await requireSuperAdmin();
  const admin = adminClient();

  const [{ data: campaigns, error }, { data: metrics, error: metricsError }] =
    await Promise.all([
      admin
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false }),
      admin
        .from('email_campaign_metrics')
        .select('campaign_id, opened_at, clicked_at'),
    ]);

  if (error) throw new Error(error.message);
  if (metricsError) throw new Error(metricsError.message);

  const metricsByCampaign = new Map<
    string,
    { rows: number; opens: number; clicks: number }
  >();

  for (const row of (metrics ?? []) as Array<{
    campaign_id: string;
    opened_at: string | null;
    clicked_at: string | null;
  }>) {
    const entry = metricsByCampaign.get(row.campaign_id) ?? {
      rows: 0,
      opens: 0,
      clicks: 0,
    };
    entry.rows += 1;
    if (row.opened_at) entry.opens += 1;
    if (row.clicked_at) entry.clicks += 1;
    metricsByCampaign.set(row.campaign_id, entry);
  }

  return ((campaigns ?? []) as EmailCampaignRow[]).map((campaign) => {
    const entry = metricsByCampaign.get(campaign.id);
    const sent = campaign.sent_count || entry?.rows || 0;
    const uniqueOpens = entry?.opens ?? 0;
    const uniqueClicks = entry?.clicks ?? 0;

    return {
      ...campaign,
      unique_opens: uniqueOpens,
      unique_clicks: uniqueClicks,
      open_rate: sent ? Math.round((uniqueOpens / sent) * 1000) / 10 : 0,
      click_rate: sent ? Math.round((uniqueClicks / sent) * 1000) / 10 : 0,
    };
  });
}

export async function loadCampaign(
  id: string,
): Promise<EmailCampaignRow | null> {
  await requireSuperAdmin();
  const admin = adminClient();
  const { data, error } = await admin
    .from('email_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmailCampaignRow | null;
}

export async function loadCampaignMetrics(id: string) {
  await requireSuperAdmin();
  const admin = adminClient();
  const [{ data: campaign, error }, { data: metrics, error: metricsError }] =
    await Promise.all([
      admin.from('email_campaigns').select('*').eq('id', id).maybeSingle(),
      admin
        .from('email_campaign_metrics')
        .select('*')
        .eq('campaign_id', id)
        .order('sent_at', { ascending: false }),
    ]);

  if (error) throw new Error(error.message);
  if (metricsError) throw new Error(metricsError.message);

  const rows = (metrics ?? []) as Array<{
    id: string;
    email: string;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    open_count: number | null;
    click_count: number | null;
    bounced: boolean | null;
    unsubscribed: boolean | null;
  }>;

  const sent = rows.filter((row) => row.sent_at).length;
  const opens = rows.filter((row) => row.opened_at).length;
  const clicks = rows.filter((row) => row.clicked_at).length;
  const bounces = rows.filter((row) => row.bounced).length;
  const unsubscribes = rows.filter((row) => row.unsubscribed).length;

  return {
    campaign: campaign as EmailCampaignRow | null,
    rows,
    summary: {
      sent,
      opens,
      openRate: sent ? Math.round((opens / sent) * 1000) / 10 : 0,
      clicks,
      clickRate: sent ? Math.round((clicks / sent) * 1000) / 10 : 0,
      bounces,
      unsubscribes,
    },
  };
}

export async function loadContacts(params?: {
  query?: string;
  trade?: string;
  source?: string;
}): Promise<EmailContactRow[]> {
  await requireSuperAdmin();
  const admin = adminClient();
  let query = admin
    .from('email_contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (params?.trade) query = query.eq('trade', params.trade);
  if (params?.source) query = query.eq('source', params.source);
  if (params?.query) {
    const pattern = `%${params.query.replace(/%/g, '\\%')}%`;
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const contacts = (data ?? []) as EmailContactRow[];
  const { data: users } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const userEmails = new Set(
    users.users.map((user) => user.email?.toLowerCase()).filter(Boolean),
  );

  return contacts.map((contact) => ({
    ...contact,
    has_signed_up: userEmails.has(contact.email.toLowerCase()),
  }));
}

export async function loadUnsubscribes(): Promise<EmailUnsubscribeRow[]> {
  await requireSuperAdmin();
  const admin = adminClient();
  const { data, error } = await admin
    .from('email_unsubscribes')
    .select('*')
    .order('unsubscribed_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmailUnsubscribeRow[];
}

export async function loadCustomRecipientUsers() {
  await requireSuperAdmin();
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw new Error(error.message);

  return data.users
    .filter((user) => user.email)
    .map((user) => ({ id: user.id, email: user.email ?? user.id }));
}

export async function loadCurrentSuperAdminEmail() {
  const userId = await requireSuperAdmin();
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw new Error(error.message);

  return data.users.find((user) => user.id === userId)?.email ?? '';
}

export type { EmailRecipientList, RecipientListMember, RecipientListSummary };

export async function loadRecipientLists(params?: {
  list?: string;
  query?: string;
}) {
  await requireSuperAdmin();
  return loadRecipientListsOverview({
    list: params?.list,
    query: params?.query?.trim() || undefined,
  });
}

export async function loadContactListsForComposer() {
  await requireSuperAdmin();
  return loadCustomContactLists();
}
