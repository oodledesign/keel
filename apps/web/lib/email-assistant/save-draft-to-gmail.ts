import 'server-only';

import { buildRawMessage, createDraft, updateDraft } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadGmailReplyHeaders } from './gmail-reply-headers';
import { resolveEmailAssistantSignature } from './resolve-signature';

function replySubject(subject: string | null | undefined) {
  const trimmed = subject?.trim();

  if (!trimmed) {
    return 'Re: (no subject)';
  }

  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function pickReplyTo(from: string | null, to: string | null) {
  return from?.trim() || to?.trim() || '';
}

export async function saveDraftToGmail(input: {
  userId: string;
  draftId: string;
  bodyText?: string;
}): Promise<{ gmailDraftId: string }> {
  const admin = getSupabaseServerAdminClient();

  const { data: draftRow, error: draftError } = await admin
    .from('email_drafts')
    .select(
      'id, user_id, thread_id, reply_to_message_id, subject, body_text, gmail_draft_id',
    )
    .eq('id', input.draftId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (draftError) {
    throw new Error(draftError.message);
  }

  if (!draftRow) {
    throw new Error('Draft not found');
  }

  const draftRecord = draftRow as {
    thread_id: string;
    reply_to_message_id: string | null;
    subject: string | null;
    body_text: string;
    gmail_draft_id: string | null;
  };

  const bodyText = input.bodyText?.trim() || draftRecord.body_text;

  if (!bodyText.trim()) {
    throw new Error('Draft body is required');
  }

  const [{ data: thread }, { data: connection }, { data: settings }] =
    await Promise.all([
      admin
        .from('email_threads')
        .select('id, gmail_thread_id, subject')
        .eq('id', draftRecord.thread_id)
        .eq('user_id', input.userId)
        .maybeSingle(),
      admin
        .from('google_connections')
        .select('google_email')
        .eq('user_id', input.userId)
        .maybeSingle(),
      admin
        .from('email_assistant_settings')
        .select('signature, signature_is_html')
        .eq('user_id', input.userId)
        .maybeSingle(),
    ]);

  if (!thread) {
    throw new Error('Thread not found');
  }

  const threadRecord = thread as {
    gmail_thread_id: string;
    subject: string | null;
  };

  let replyMessageGmailId: string | null = null;

  if (draftRecord.reply_to_message_id) {
    const { data: replyMessage } = await admin
      .from('email_messages')
      .select('gmail_message_id')
      .eq('id', draftRecord.reply_to_message_id)
      .eq('user_id', input.userId)
      .maybeSingle();

    replyMessageGmailId =
      (replyMessage as { gmail_message_id?: string | null } | null)
        ?.gmail_message_id ?? null;
  }

  if (!replyMessageGmailId) {
    const { data: latestMessage } = await admin
      .from('email_messages')
      .select('gmail_message_id')
      .eq('thread_id', draftRecord.thread_id)
      .eq('user_id', input.userId)
      .order('internal_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    replyMessageGmailId =
      (latestMessage as { gmail_message_id?: string | null } | null)
        ?.gmail_message_id ?? null;
  }

  if (!replyMessageGmailId) {
    throw new Error('Could not find a Gmail message to reply to');
  }

  const headers = await loadGmailReplyHeaders(
    input.userId,
    replyMessageGmailId,
  );

  const ownerEmail =
    (connection as { google_email?: string | null } | null)?.google_email ??
    undefined;

  const signature = await resolveEmailAssistantSignature(
    input.userId,
    (settings as { signature?: string | null } | null)?.signature ?? null,
    Boolean(
      (settings as { signature_is_html?: boolean | null } | null)
        ?.signature_is_html,
    ),
  );

  const raw = buildRawMessage({
    from: ownerEmail,
    to: pickReplyTo(headers.from, headers.to),
    subject: replySubject(draftRecord.subject ?? threadRecord.subject),
    body: bodyText,
    signatureHtml: signature.html,
    plainSignature: signature.plain,
    inReplyTo: headers.messageId ?? undefined,
    references: headers.references ?? headers.messageId ?? undefined,
  });

  const gmailDraft = draftRecord.gmail_draft_id
    ? await updateDraft(input.userId, draftRecord.gmail_draft_id, raw)
    : await createDraft(input.userId, {
        threadId: threadRecord.gmail_thread_id,
        raw,
      });

  const gmailDraftId = gmailDraft.id ?? draftRecord.gmail_draft_id;

  if (!gmailDraftId) {
    throw new Error('Gmail did not return a draft id');
  }

  const { error: updateError } = await admin
    .from('email_drafts')
    .update({
      body_text: bodyText,
      gmail_draft_id: gmailDraftId,
      status: 'saved_to_gmail',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.draftId)
    .eq('user_id', input.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { gmailDraftId };
}
