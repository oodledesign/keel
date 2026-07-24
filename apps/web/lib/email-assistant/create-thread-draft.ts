import 'server-only';

import { DEFAULT_ANTHROPIC_MODEL, draft } from '@kit/email-assistant';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { resolveDraftOwnerContext } from './draft-owner';
import { resolveEmailAssistantSignature } from './resolve-signature';
import { saveDraftToGmail } from './save-draft-to-gmail';
import { buildThreadText } from './thread-text';

export async function createThreadDraft(input: {
  userId: string;
  threadId: string;
  saveToGmail?: boolean;
}): Promise<{ draftId: string; gmailDraftId?: string } | null> {
  const admin = getSupabaseServerAdminClient();

  const { data: threadRow } = await admin
    .from('email_threads')
    .select('id, subject, connection_id')
    .eq('id', input.threadId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (!threadRow) {
    return null;
  }

  const thread = threadRow as {
    id: string;
    subject: string | null;
    connection_id: string | null;
  };

  let mailboxKind: 'business' | 'personal' = 'business';
  if (thread.connection_id) {
    const { data: connection } = await admin
      .from('google_connections')
      .select('mailbox_kind')
      .eq('id', thread.connection_id)
      .maybeSingle();
    const kind = (connection as { mailbox_kind?: string } | null)?.mailbox_kind;
    if (kind === 'personal' || kind === 'business') {
      mailboxKind = kind;
    }
  }

  const owner = await resolveDraftOwnerContext(input.userId, mailboxKind);

  if (!owner) {
    return null;
  }

  const connectionId = owner.connectionId ?? thread.connection_id;

  const { data: settings } = connectionId
    ? await admin
        .from('email_assistant_settings')
        .select('style_notes, signature, signature_is_html')
        .eq('connection_id', connectionId)
        .maybeSingle()
    : await admin
        .from('email_assistant_settings')
        .select('style_notes, signature, signature_is_html')
        .eq('user_id', input.userId)
        .limit(1)
        .maybeSingle();

  const { data: messages, error: messagesError } = await admin
    .from('email_messages')
    .select(
      'id, from_address, subject, body_text, snippet, internal_date, created_at',
    )
    .eq('thread_id', input.threadId)
    .eq('user_id', input.userId)
    .order('internal_date', { ascending: true, nullsFirst: false });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const threadText = buildThreadText(messages ?? []);

  if (!threadText.trim()) {
    return null;
  }

  const latestMessageId =
    (messages?.at(-1) as { id?: string } | undefined)?.id ?? null;

  if (latestMessageId) {
    const { data: existingDraft } = await admin
      .from('email_drafts')
      .select('id, reply_to_message_id, gmail_draft_id, status')
      .eq('thread_id', input.threadId)
      .eq('user_id', input.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const existing = existingDraft as {
      id: string;
      reply_to_message_id: string | null;
      gmail_draft_id: string | null;
      status: string;
    } | null;

    if (existing?.reply_to_message_id === latestMessageId) {
      if (input.saveToGmail && !existing.gmail_draft_id) {
        const saved = await saveDraftToGmail({
          userId: input.userId,
          draftId: existing.id,
        });
        return { draftId: existing.id, gmailDraftId: saved.gmailDraftId };
      }

      return {
        draftId: existing.id,
        gmailDraftId: existing.gmail_draft_id ?? undefined,
      };
    }
  }

  const signature = await resolveEmailAssistantSignature(
    input.userId,
    (settings as { signature?: string | null } | null)?.signature ?? null,
    Boolean(
      (settings as { signature_is_html?: boolean | null } | null)
        ?.signature_is_html,
    ),
  );

  const bodyText = await draft(
    threadText,
    owner,
    (settings as { style_notes?: string | null } | null)?.style_notes ?? null,
    signature.plain,
  );

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;

  const { data: inserted, error: insertError } = await admin
    .from('email_drafts')
    .insert({
      user_id: input.userId,
      thread_id: input.threadId,
      reply_to_message_id: latestMessageId,
      subject: (thread as { subject?: string | null }).subject ?? null,
      body_text: bodyText,
      status: 'draft',
      model,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? 'Could not create draft');
  }

  const draftId = (inserted as { id: string }).id;

  if (input.saveToGmail) {
    const saved = await saveDraftToGmail({
      userId: input.userId,
      draftId,
      bodyText,
    });
    return { draftId, gmailDraftId: saved.gmailDraftId };
  }

  return { draftId };
}
