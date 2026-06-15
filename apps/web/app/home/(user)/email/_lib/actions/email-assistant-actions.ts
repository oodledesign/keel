'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { redirectIfEmailAssistantNotAllowed } from '~/lib/billing/require-email-assistant-access';

import type {
  EmailActionItemRow,
  EmailDraftRow,
  EmailMessageRow,
  EmailThreadDetail,
} from '../types';
import { loadEmailThreadDetailFromDb } from '../server/email-page.loader';

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
): Promise<{ ok: true; data: EmailThreadDetail } | { ok: false; error: string }> {
  const client = getSupabaseServerClient();
  const user = await requireEmailAssistantAccess();

  const thread = await loadEmailThreadDetailFromDb(threadId);

  if (!thread) {
    return { ok: false, error: 'Thread not found' };
  }

  const [messagesResult, actionItemsResult, draftResult] = await Promise.all([
    client
      .from('email_messages')
      .select(
        'id, from_address, subject, body_text, snippet, internal_date',
      )
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .order('internal_date', { ascending: true, nullsFirst: false }),
    client
      .from('email_action_items')
      .select(
        'id, title, detail, suggested_due_date, status, task_id, created_at',
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

  if (messagesResult.error) {
    return { ok: false, error: messagesResult.error.message };
  }

  if (actionItemsResult.error) {
    return { ok: false, error: actionItemsResult.error.message };
  }

  if (draftResult.error) {
    return { ok: false, error: draftResult.error.message };
  }

  return {
    ok: true,
    data: {
      thread,
      messages: (messagesResult.data ?? []) as EmailMessageRow[],
      actionItems: (actionItemsResult.data ?? []) as EmailActionItemRow[],
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
}) {
  const client = getSupabaseServerClient();
  const user = await requireEmailAssistantAccess();

  const { error } = await client.from('email_assistant_settings').upsert(
    {
      user_id: user.id,
      style_notes: input.styleNotes.trim() || null,
      signature: input.signature.trim() || null,
      signature_is_html: input.signatureIsHtml,
      auto_triage_enabled: input.autoTriageEnabled,
      auto_draft_enabled: input.autoDraftEnabled,
      auto_save_gmail_drafts: input.autoSaveGmailDrafts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateEmailPage();
  return { success: true as const, error: null };
}

export async function disconnectGmailConnection() {
  const client = getSupabaseServerClient();
  const user = await requireEmailAssistantAccess();

  const { error } = await client
    .from('google_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateEmailPage();
  return { success: true as const, error: null };
}
