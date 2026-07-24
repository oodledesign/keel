'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';
import {
  enrichEmailActionItemLinks,
  syncSuggestedActionItemsFromThreadLink,
} from '~/lib/email-assistant/action-item-links';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadEmailThreadDetailFromDb } from '../server/email-page.loader';
import type {
  EmailActionItemRow,
  EmailDraftRow,
  EmailMessageRow,
  EmailThreadDetail,
} from '../types';

const EMAIL_PATH = '/app/email';

function revalidateEmailPage() {
  revalidatePath('/home/email');
  revalidatePath(EMAIL_PATH);
}

async function requireEmailAssistantAccess() {
  await redirectIfEmailAssistantNotAllowed();
  return requireUserInServerComponent();
}

export async function loadEmailThreadDetail(
  threadId: string,
): Promise<
  { ok: true; data: EmailThreadDetail } | { ok: false; error: string }
> {
  // Page routes already gate email-assistant access; avoid a billing + entitlement
  // round-trip on every thread click.
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const [thread, messagesResult, actionItemsResult, draftResult] =
    await Promise.all([
      loadEmailThreadDetailFromDb(threadId),
      client
        .from('email_messages')
        .select('id, from_address, subject, body_text, snippet, internal_date')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .order('internal_date', { ascending: true, nullsFirst: false }),
      client
        .from('email_action_items')
        .select(
          'id, title, detail, suggested_due_date, source_excerpt, assignee_confidence, suggested_assignee_id, account_id, client_id, project_id, status, task_id, created_at',
        )
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      client
        .from('email_drafts')
        .select('id, body_text, gmail_draft_id, status, updated_at')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!thread) {
    return { ok: false, error: 'Thread not found' };
  }

  if (messagesResult.error) {
    return { ok: false, error: messagesResult.error.message };
  }

  if (actionItemsResult.error) {
    return { ok: false, error: actionItemsResult.error.message };
  }

  if (draftResult.error) {
    return { ok: false, error: draftResult.error.message };
  }

  let actionItems = (actionItemsResult.data ?? []) as EmailActionItemRow[];

  // Best-effort link backfill — paint with in-memory ids first; persist async.
  if (thread.link.linked && (thread.link.clientId || thread.link.projectId)) {
    const needsSync = actionItems.some(
      (item) =>
        item.status === 'suggested' && !item.client_id && !item.project_id,
    );

    if (needsSync) {
      for (const item of actionItems) {
        if (item.status !== 'suggested') continue;
        if (item.client_id || item.project_id) continue;
        item.account_id = thread.link.accountId;
        item.client_id = thread.link.clientId;
        item.project_id = thread.link.projectId;
      }

      void syncSuggestedActionItemsFromThreadLink(client, user.id, threadId, {
        accountId: thread.link.accountId,
        clientId: thread.link.clientId,
        projectId: thread.link.projectId,
      }).catch(() => {
        // Keep showing items even if backfill fails.
      });
    }
  }

  return {
    ok: true,
    data: {
      thread,
      messages: (messagesResult.data ?? []) as EmailMessageRow[],
      actionItems: await enrichEmailActionItemLinks(actionItems),
      draft: (draftResult.data as EmailDraftRow | null) ?? null,
    },
  };
}

export async function saveEmailAssistantSettings(input: {
  styleNotes: string;
  signature: string;
  signatureIsHtml: boolean;
  autoTriageEnabled: boolean;
  autoDraftEnabled: boolean;
  autoSaveGmailDrafts: boolean;
  mailboxKind?: 'business' | 'personal';
}) {
  const client = getSupabaseServerClient();
  const user = await requireEmailAssistantAccess();
  const mailboxKind = input.mailboxKind ?? 'personal';

  const { data: connection, error: connectionError } = await client
    .from('google_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  if (connectionError) {
    return { success: false as const, error: connectionError.message };
  }

  const connectionId = (connection as { id?: string } | null)?.id;

  if (!connectionId) {
    return {
      success: false as const,
      error: 'Connect Gmail before saving settings',
    };
  }

  const { error } = await client.from('email_assistant_settings').upsert(
    {
      user_id: user.id,
      connection_id: connectionId,
      style_notes: input.styleNotes.trim() || null,
      signature: input.signature.trim() || null,
      signature_is_html: input.signatureIsHtml,
      auto_triage_enabled: input.autoTriageEnabled,
      auto_draft_enabled: input.autoDraftEnabled,
      auto_save_gmail_drafts: input.autoSaveGmailDrafts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'connection_id' },
  );

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateEmailPage();
  return { success: true as const, error: null };
}

export async function disconnectGmailConnection(input?: {
  mailboxKind?: 'business' | 'personal';
}) {
  const client = getSupabaseServerClient();
  const user = await requireEmailAssistantAccess();
  const mailboxKind = input?.mailboxKind ?? 'personal';

  const { error } = await client
    .from('google_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('mailbox_kind', mailboxKind);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateEmailPage();
  return { success: true as const, error: null };
}
