import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import { EMAIL_THREAD_CATEGORIES } from '~/lib/email-assistant/email-thread-categories';
import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';

import {
  RECORDER_TODAY_TRIAGE_UNAVAILABLE_REASON,
  buildRecorderTriageSummary,
} from './recorder-today-triage.shared';

export type RecorderTodayEmailTriage = {
  mailbox_kind: MailboxKind;
  reply_now: number;
  reply_later: number;
  waiting: number;
  suggested_tasks: number;
  path: string;
  suggested_tasks_path: string;
};

export type RecorderTodayTaskTriage = {
  suggested_email: number;
  meeting_review: number;
  suggested_email_path: string;
  meeting_review_path: string | null;
};

export type RecorderTodayTriage = {
  email: RecorderTodayEmailTriage | null;
  tasks: RecorderTodayTaskTriage | null;
  summary: string | null;
};

export { RECORDER_TODAY_TRIAGE_UNAVAILABLE_REASON, buildRecorderTriageSummary };

function isMissingTableError(
  error: {
    message?: string;
    code?: string;
  } | null,
): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

async function countExact(
  query: PromiseLike<{
    count: number | null;
    error: { message?: string; code?: string } | null;
  }>,
): Promise<number | null> {
  const { count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw new Error(
      `[recorder/today] triage ${error.code ?? ''}: ${error.message ?? 'query failed'}`.trim(),
    );
  }
  return count ?? 0;
}

async function loadMailboxConnection(
  admin: SupabaseClient,
  userId: string,
  mailboxKind: MailboxKind,
): Promise<string | null> {
  const { data, error } = await admin
    .from('google_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw new Error(
      `[recorder/today] mailbox ${error.code ?? ''}: ${error.message ?? 'query failed'}`.trim(),
    );
  }

  return (data as { id?: string } | null)?.id ?? null;
}

async function countEmailCategory(
  admin: SupabaseClient,
  userId: string,
  connectionId: string,
  category: (typeof EMAIL_THREAD_CATEGORIES)[number],
): Promise<number | null> {
  return countExact(
    admin
      .from('email_threads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .eq('assistant_category', category),
  );
}

export async function loadRecorderTodayTriage(
  admin: SupabaseClient,
  userId: string,
  preferredAccountId?: string | null,
): Promise<RecorderTodayTriage | null> {
  const workspaces = await loadUserWorkspaceAccounts(admin, userId);
  const accountIds = workspaces.map((workspace) => workspace.id);
  const preferredWorkspace =
    workspaces.find((workspace) => workspace.id === preferredAccountId) ??
    workspaces[0] ??
    null;
  const preferredSlug = preferredWorkspace?.slug?.trim() || null;

  const [personalConnectionId, businessConnectionId] = await Promise.all([
    loadMailboxConnection(admin, userId, 'personal'),
    loadMailboxConnection(admin, userId, 'business'),
  ]);

  const mailboxKind: MailboxKind | null = personalConnectionId
    ? 'personal'
    : businessConnectionId
      ? 'business'
      : null;
  const connectionId = personalConnectionId ?? businessConnectionId;

  const suggestedTasks = await countExact(
    admin
      .from('email_action_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'suggested'),
  );

  const meetingReview =
    accountIds.length === 0
      ? 0
      : await countExact(
          admin
            .from('meeting_action_items')
            .select('id', { count: 'exact', head: true })
            .in('account_id', accountIds)
            .eq('status', 'pending_review'),
        );

  let email: RecorderTodayEmailTriage | null = null;

  if (connectionId && mailboxKind) {
    const [replyNow, replyLater, waiting] = await Promise.all([
      countEmailCategory(admin, userId, connectionId, 'reply_now'),
      countEmailCategory(admin, userId, connectionId, 'reply_later'),
      countEmailCategory(admin, userId, connectionId, 'waiting'),
    ]);

    if (replyNow !== null && replyLater !== null && waiting !== null) {
      const emailPath =
        mailboxKind === 'business' && preferredSlug
          ? `${workAccountPath(pathsConfig.app.accountEmailAssistant, preferredSlug)}?filter=action`
          : `${pathsConfig.app.personalEmailAssistant}?filter=action`;
      const suggestedPath =
        mailboxKind === 'business' && preferredSlug
          ? workAccountPath(
              pathsConfig.app.accountEmailSuggestedTasks,
              preferredSlug,
            )
          : pathsConfig.app.personalEmailSuggestedTasks;

      email = {
        mailbox_kind: mailboxKind,
        reply_now: replyNow,
        reply_later: replyLater,
        waiting,
        suggested_tasks: suggestedTasks ?? 0,
        path: emailPath,
        suggested_tasks_path: suggestedPath,
      };
    }
  }

  const tasksAvailable = suggestedTasks !== null || meetingReview !== null;
  const tasks: RecorderTodayTaskTriage | null = tasksAvailable
    ? {
        suggested_email: suggestedTasks ?? 0,
        meeting_review: meetingReview ?? 0,
        suggested_email_path:
          email?.suggested_tasks_path ??
          pathsConfig.app.personalEmailSuggestedTasks,
        meeting_review_path: preferredSlug
          ? workAccountPath(pathsConfig.app.accountTasksReview, preferredSlug)
          : null,
      }
    : null;

  if (!email && !tasks) {
    return null;
  }

  if (
    !email &&
    (tasks?.suggested_email ?? 0) === 0 &&
    (tasks?.meeting_review ?? 0) === 0
  ) {
    return null;
  }

  return {
    email,
    tasks,
    summary: email
      ? buildRecorderTriageSummary({
          replyNow: email.reply_now,
          replyLater: email.reply_later,
          suggestedTasks: email.suggested_tasks,
          meetingReview: tasks?.meeting_review ?? 0,
        })
      : buildRecorderTriageSummary({
          replyNow: 0,
          replyLater: 0,
          suggestedTasks: tasks?.suggested_email ?? 0,
          meetingReview: tasks?.meeting_review ?? 0,
        }),
  };
}
