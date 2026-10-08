import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  MESSAGE_REPORT_REASON_LABELS,
  type MessageReportReason,
} from '~/lib/messages/message-safety-shared';
import { loadUserDisplayNames } from '~/lib/native/messages';

export type MessageReportStatus = 'open' | 'actioned' | 'dismissed';

export type AdminMessageReport = {
  id: string;
  status: MessageReportStatus;
  reasonLabel: string;
  details: string | null;
  messageBody: string | null;
  createdAt: string;
  resolvedAt: string | null;
  isConversationReport: boolean;
  workspace: { id: string; name: string };
  reporter: { id: string; name: string; email: string | null };
  reported: {
    id: string;
    name: string;
    email: string | null;
    reportCount: number;
  } | null;
};

type ReportRow = {
  id: string;
  account_id: string;
  message_id: string | null;
  reporter_user_id: string;
  reported_user_id: string | null;
  reason: MessageReportReason;
  details: string | null;
  message_body: string | null;
  status: MessageReportStatus;
  created_at: string;
  resolved_at: string | null;
};

export async function loadAdminMessageReports(filter: 'open' | 'all') {
  // Super-admin only (AdminGuard); the service role reads every report.
  const admin = getSupabaseServerAdminClient() as unknown as SupabaseClient;

  let query = admin
    .from('chat_message_reports')
    .select(
      'id, account_id, message_id, reporter_user_id, reported_user_id, reason, details, message_body, status, created_at, resolved_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (filter === 'open') {
    query = query.eq('status', 'open');
  }

  const [{ data, error }, { count: openCount }] = await Promise.all([
    query,
    admin
      .from('chat_message_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ]);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ReportRow[];
  const userIds = [
    ...new Set(
      rows.flatMap((row) =>
        [row.reporter_user_id, row.reported_user_id].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
  ];
  const reportedIds = [
    ...new Set(
      rows
        .map((row) => row.reported_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const accountIds = [...new Set(rows.map((row) => row.account_id))];

  const [names, usersRes, accountsRes, reportedRes] = await Promise.all([
    loadUserDisplayNames(userIds),
    userIds.length
      ? admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      : Promise.resolve({ data: { users: [] } }),
    accountIds.length
      ? admin.from('accounts').select('id, name').in('id', accountIds)
      : Promise.resolve({ data: [] }),
    reportedIds.length
      ? admin
          .from('chat_message_reports')
          .select('reported_user_id')
          .in('reported_user_id', reportedIds)
          .limit(5000)
      : Promise.resolve({ data: [] }),
  ]);

  const emailById = new Map<string, string | null>(
    (usersRes.data?.users ?? []).map((user: { id: string; email?: string }) => [
      user.id,
      user.email ?? null,
    ]),
  );
  const accountNameById = new Map<string, string>(
    (
      (accountsRes.data ?? []) as Array<{ id: string; name: string | null }>
    ).map((row) => [row.id, row.name?.trim() || 'Unnamed workspace']),
  );
  const reportCountByUser = new Map<string, number>();
  for (const row of (reportedRes.data ?? []) as Array<{
    reported_user_id: string;
  }>) {
    reportCountByUser.set(
      row.reported_user_id,
      (reportCountByUser.get(row.reported_user_id) ?? 0) + 1,
    );
  }

  const reports: AdminMessageReport[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    reasonLabel: MESSAGE_REPORT_REASON_LABELS[row.reason] ?? row.reason,
    details: row.details,
    messageBody: row.message_body,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    isConversationReport: !row.message_id && !row.message_body,
    workspace: {
      id: row.account_id,
      name: accountNameById.get(row.account_id) ?? 'Unknown workspace',
    },
    reporter: {
      id: row.reporter_user_id,
      name: names.get(row.reporter_user_id) ?? 'Someone',
      email: emailById.get(row.reporter_user_id) ?? null,
    },
    reported: row.reported_user_id
      ? {
          id: row.reported_user_id,
          name: names.get(row.reported_user_id) ?? 'Someone',
          email: emailById.get(row.reported_user_id) ?? null,
          reportCount: reportCountByUser.get(row.reported_user_id) ?? 1,
        }
      : null,
  }));

  return { reports, openCount: openCount ?? 0 };
}
