import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createMessagesService } from '~/home/[account]/messages/_lib/server/messages.service';
import {
  resolveTransactionalEmailFrom,
  sendTransactionalEmail,
} from '~/lib/email/zeptomail-client';
import { NativeHttpError } from '~/lib/native/http';
import { loadUserDisplayNames, mapMessagesError } from '~/lib/native/messages';

import {
  type BlockedChatUser,
  MESSAGE_REPORT_REASON_LABELS,
  MESSAGE_REPORT_SOURCE_LABELS,
  type MessageReportReason,
  type MessageReportSource,
} from './message-safety-shared';

const REPORTS_INBOX = 'hi@ozer.so';
const DAILY_REPORT_LIMIT = 20;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function admin() {
  // Tables land in generated types after the next typegen.
  return getSupabaseServerAdminClient() as unknown as SupabaseClient;
}

async function insertBlock(blockerUserId: string, blockedUserId: string) {
  const { error } = await admin().from('chat_user_blocks').upsert(
    { blocker_user_id: blockerUserId, blocked_user_id: blockedUserId },
    {
      onConflict: 'blocker_user_id,blocked_user_id',
      ignoreDuplicates: true,
    },
  );
  if (error) {
    throw new NativeHttpError(500, 'Could not block this person');
  }
}

export async function listBlockedChatUsers(
  userId: string,
): Promise<BlockedChatUser[]> {
  const { data, error } = await admin()
    .from('chat_user_blocks')
    .select('blocked_user_id, created_at')
    .eq('blocker_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new NativeHttpError(500, 'Could not load blocked people');
  }

  const rows = (data ?? []) as Array<{
    blocked_user_id: string;
    created_at: string;
  }>;
  const names = await loadUserDisplayNames(
    rows.map((row) => row.blocked_user_id),
  );
  return rows.map((row) => ({
    user_id: row.blocked_user_id,
    display_name: names.get(row.blocked_user_id) ?? 'Someone',
    created_at: row.created_at,
  }));
}

/** You can only block someone you share a conversation with. */
async function sharesThread(userId: string, otherUserId: string) {
  const { data: theirs } = await admin()
    .from('chat_thread_participants')
    .select('thread_id')
    .eq('participant_user_id', otherUserId)
    .limit(500);
  const threadIds = ((theirs ?? []) as Array<{ thread_id: string }>).map(
    (row) => row.thread_id,
  );
  if (threadIds.length === 0) return false;

  const { data: shared } = await admin()
    .from('chat_thread_participants')
    .select('thread_id')
    .eq('participant_user_id', userId)
    .in('thread_id', threadIds)
    .limit(1);
  return (shared ?? []).length > 0;
}

export async function blockChatUser(userId: string, blockedUserId: string) {
  if (blockedUserId === userId) {
    throw new NativeHttpError(400, 'You cannot block yourself');
  }
  if (!(await sharesThread(userId, blockedUserId))) {
    throw new NativeHttpError(404, 'Person not found');
  }

  await insertBlock(userId, blockedUserId);
  return { blocked: true };
}

export async function unblockChatUser(userId: string, blockedUserId: string) {
  const { error } = await admin()
    .from('chat_user_blocks')
    .delete()
    .eq('blocker_user_id', userId)
    .eq('blocked_user_id', blockedUserId);
  if (error) {
    throw new NativeHttpError(500, 'Could not unblock this person');
  }
  return { blocked: false };
}

type ReportedMessage = {
  id: string;
  sender_user_id: string;
  body: string;
  image_url: string | null;
};

async function loadReportedMessage(threadId: string, messageId: string) {
  const { data } = await admin()
    .from('chat_messages')
    .select('id, sender_user_id, body, image_url')
    .eq('id', messageId)
    .eq('thread_id', threadId)
    .maybeSingle();
  if (!data) {
    throw new NativeHttpError(404, 'Message not found');
  }
  return data as ReportedMessage;
}

/** Re-reporting the same message or conversation returns the open report instead of emailing again. */
async function findOpenReport(
  reporterUserId: string,
  threadId: string,
  messageId: string | null,
) {
  let query = admin()
    .from('chat_message_reports')
    .select('id')
    .eq('reporter_user_id', reporterUserId)
    .eq('thread_id', threadId)
    .eq('status', 'open');
  query = messageId
    ? query.eq('message_id', messageId)
    : query.is('message_id', null);
  const { data } = await query.limit(1).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function assertUnderDailyReportLimit(reporterUserId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin()
    .from('chat_message_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_user_id', reporterUserId)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_REPORT_LIMIT) {
    throw new NativeHttpError(
      429,
      'You’ve sent a lot of reports today. Email hi@ozer.so if you need to report more.',
    );
  }
}

async function loadUserEmail(userId: string) {
  const { data } =
    await getSupabaseServerAdminClient().auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function loadAccountLabel(accountId: string) {
  const { data } = await admin()
    .from('accounts')
    .select('name, slug')
    .eq('id', accountId)
    .maybeSingle();
  const row = data as { name: string | null; slug: string | null } | null;
  const name = row?.name?.trim() || 'Unknown workspace';
  return row?.slug ? `${name} (${row.slug})` : name;
}

async function emailReport(params: {
  reportId: string;
  accountId: string;
  source: MessageReportSource;
  threadId: string;
  messageId: string | null;
  reason: MessageReportReason;
  details: string | undefined;
  messageBody: string | null;
  reporterUserId: string;
  reportedUserId: string | null;
  names: Map<string, string>;
  blocked: boolean;
}) {
  const from = resolveTransactionalEmailFrom('Ozer');
  if (!from) return;

  const [reporterEmail, workspace] = await Promise.all([
    loadUserEmail(params.reporterUserId),
    loadAccountLabel(params.accountId),
  ]);
  const reporter = params.names.get(params.reporterUserId) ?? 'Someone';
  const reported = params.reportedUserId
    ? (params.names.get(params.reportedUserId) ?? 'Unknown person')
    : 'Not identified (conversation report)';
  const reason = MESSAGE_REPORT_REASON_LABELS[params.reason];
  const source = MESSAGE_REPORT_SOURCE_LABELS[params.source];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  const reviewUrl = siteUrl ? `${siteUrl}/admin/message-reports` : null;

  const rows: Array<[string, string]> = [
    ['Reason', reason],
    ['Workspace', workspace],
    ['Reported from', source],
    ['Reported by', `${reporter}${reporterEmail ? ` <${reporterEmail}>` : ''}`],
    ['Reported person', reported],
    ['Reporter blocked them', params.blocked ? 'Yes' : 'No'],
    ['Details', params.details ?? '-'],
    ['Message', params.messageBody?.trim() || '-'],
    ['Report ID', params.reportId],
    ['Thread ID', params.threadId],
    ['Message ID', params.messageId ?? '-'],
    ['Reported user ID', params.reportedUserId ?? '-'],
  ];

  const intro = `A message was reported in ${source}. Review within 24 hours.`;
  const textBody = [
    intro,
    ...(reviewUrl ? [`Review: ${reviewUrl}`] : []),
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
  const reviewLink = reviewUrl
    ? `<p><a href="${escapeHtml(reviewUrl)}">Open message reports</a></p>`
    : '';
  const htmlBody = `<p>${escapeHtml(intro)}</p>${reviewLink}<table cellpadding="6">${rows
    .map(
      ([label, value]) =>
        `<tr><td valign="top"><strong>${escapeHtml(label)}</strong></td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join('')}</table>`;

  try {
    await sendTransactionalEmail({
      to: REPORTS_INBOX,
      subject: `Message report: ${reason} (${workspace})`,
      htmlBody,
      textBody,
      from,
      ...(reporterEmail ? { replyTo: reporterEmail } : {}),
    });
  } catch (error) {
    console.error('[message-report] email failed', {
      reportId: params.reportId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function reportChatMessage(params: {
  userId: string;
  accountId: string;
  threadId: string;
  messageId?: string;
  reason: MessageReportReason;
  details?: string;
  block: boolean;
  source: MessageReportSource;
}) {
  const thread = await createMessagesService()
    .getThread({
      accountId: params.accountId,
      userId: params.userId,
      threadId: params.threadId,
    })
    .catch(mapMessagesError);

  const message = params.messageId
    ? await loadReportedMessage(params.threadId, params.messageId)
    : null;

  let reportedUserId: string | null = null;
  if (message) {
    if (message.sender_user_id === params.userId) {
      throw new NativeHttpError(400, 'You cannot report your own message');
    }
    reportedUserId = message.sender_user_id;
  } else if (thread.type === 'direct') {
    reportedUserId =
      thread.participants.find(
        (participant) =>
          participant.user_id && participant.user_id !== params.userId,
      )?.user_id ?? null;
  }

  const existingId = await findOpenReport(
    params.userId,
    params.threadId,
    message?.id ?? null,
  );
  if (!existingId) {
    await assertUnderDailyReportLimit(params.userId);
  }

  const blocked = Boolean(params.block && reportedUserId);
  if (blocked && reportedUserId) {
    await insertBlock(params.userId, reportedUserId);
  }
  const blockedUserId = blocked ? reportedUserId : null;

  if (existingId) {
    return { id: existingId, blocked, blocked_user_id: blockedUserId };
  }

  const messageBody = message
    ? [message.body, message.image_url ? `[image] ${message.image_url}` : '']
        .filter(Boolean)
        .join('\n')
    : null;

  const { data, error } = await admin()
    .from('chat_message_reports')
    .insert({
      account_id: params.accountId,
      thread_id: params.threadId,
      message_id: message?.id ?? null,
      reporter_user_id: params.userId,
      reported_user_id: reportedUserId,
      reason: params.reason,
      details: params.details ?? null,
      message_body: messageBody,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new NativeHttpError(500, 'Could not send the report');
  }
  const reportId = (data as { id: string }).id;

  const names = await loadUserDisplayNames(
    [params.userId, reportedUserId ?? ''].filter(Boolean),
  );
  await emailReport({
    reportId,
    accountId: params.accountId,
    source: params.source,
    threadId: params.threadId,
    messageId: message?.id ?? null,
    reason: params.reason,
    details: params.details,
    messageBody,
    reporterUserId: params.userId,
    reportedUserId,
    names,
    blocked,
  });

  return { id: reportId, blocked, blocked_user_id: blockedUserId };
}
