import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

export type PlatformEmailLogRow = {
  id: string;
  email_type: string;
  account_id: string | null;
  account_name: string | null;
  account_slug: string | null;
  recipient_email: string;
  sender_email: string | null;
  subject: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type GroupedEmailLogCampaignRow = {
  id: string;
  title: string;
  recipient_list: string;
  total_sent: number;
  sent_at: string | null;
};

export async function loadPlatformEmailLog(params: {
  emailType?: string;
  accountId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: PlatformEmailLogRow[]; total: number }> {
  await requireSuperAdmin();
  const client = getSupabaseServerClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = (client as unknown as { from: (table: string) => ReturnType<typeof client.from> })
    .from('platform_email_log')
    .select(
      `
        id,
        email_type,
        account_id,
        recipient_email,
        sender_email,
        subject,
        status,
        error_message,
        metadata,
        created_at,
        accounts:account_id (
          name,
          slug
        )
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (params.emailType) {
    query = query.eq('email_type', params.emailType);
  }

  if (params.accountId) {
    query = query.eq('account_id', params.accountId);
  }

  const q = params.query?.trim();
  if (q) {
    const pattern = `%${q.replace(/%/g, '\\%')}%`;
    query = query.or(
      `recipient_email.ilike.${pattern},subject.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows: PlatformEmailLogRow[] = (data ?? []).map((raw) => {
    const row = raw as unknown as {
      id: string;
      email_type: string;
      account_id: string | null;
      recipient_email: string;
      sender_email: string | null;
      subject: string;
      status: 'sent' | 'failed';
      error_message: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
      accounts: { name: string | null; slug: string | null } | null;
    };

    return {
      id: row.id,
      email_type: row.email_type,
      account_id: row.account_id,
      account_name: row.accounts?.name ?? null,
      account_slug: row.accounts?.slug ?? null,
      recipient_email: row.recipient_email,
      sender_email: row.sender_email,
      subject: row.subject,
      status: row.status,
      error_message: row.error_message,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
    };
  });

  return {
    rows,
    total: count ?? 0,
  };
}

export async function loadGroupedCampaignEmailLog(): Promise<GroupedEmailLogCampaignRow[]> {
  await requireSuperAdmin();
  const client = getSupabaseServerClient();

  const { data, error } = await (
    client as unknown as { from: (table: string) => ReturnType<typeof client.from> }
  )
    .from('email_campaigns')
    .select('id, title, recipient_list, sent_count, sent_at, created_at')
    .in('status', ['sending', 'sent'])
    .order('sent_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Array<{
    id: string;
    title: string;
    recipient_list: string;
    sent_count: number | null;
    sent_at: string | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    recipient_list: row.recipient_list,
    total_sent: row.sent_count ?? 0,
    sent_at: row.sent_at ?? row.created_at,
  }));
}

export async function loadEmailLogBusinessOptions(): Promise<
  Array<{ id: string; name: string | null; slug: string | null }>
> {
  await requireSuperAdmin();
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('accounts')
    .select('id, name, slug')
    .eq('is_personal_account', false)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{ id: string; name: string | null; slug: string | null }>;
}
