import { buildRawMessage, createDraft, updateDraft } from '@kit/gmail';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { loadGmailReplyHeaders } from '~/lib/email-assistant/gmail-reply-headers';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SaveDraftBody = {
  bodyText?: string;
};

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

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: draftId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as SaveDraftBody;

  const { data: draftRow, error: draftError } = await auth.client
    .from('email_drafts')
    .select(
      'id, user_id, thread_id, reply_to_message_id, subject, body_text, gmail_draft_id, status',
    )
    .eq('id', draftId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (draftError) {
    return jsonErr('LOAD_FAILED', draftError.message, 500);
  }

  if (!draftRow) {
    return jsonErr('NOT_FOUND', 'Draft not found', 404);
  }

  const draftRecord = draftRow as {
    id: string;
    thread_id: string;
    reply_to_message_id: string | null;
    subject: string | null;
    body_text: string;
    gmail_draft_id: string | null;
  };

  const bodyText = body.bodyText?.trim() || draftRecord.body_text;

  if (!bodyText.trim()) {
    return jsonErr('VALIDATION', 'Draft body is required', 400);
  }

  const [{ data: thread, error: threadError }, { data: connection }] =
    await Promise.all([
      auth.client
        .from('email_threads')
        .select('id, gmail_thread_id, subject')
        .eq('id', draftRecord.thread_id)
        .eq('user_id', auth.user.id)
        .maybeSingle(),
      auth.client
        .from('google_connections')
        .select('google_email')
        .eq('user_id', auth.user.id)
        .maybeSingle(),
    ]);

  if (threadError) {
    return jsonErr('LOAD_FAILED', threadError.message, 500);
  }

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const threadRecord = thread as {
    gmail_thread_id: string;
    subject: string | null;
  };

  let replyMessageGmailId: string | null = null;

  if (draftRecord.reply_to_message_id) {
    const { data: replyMessage } = await auth.client
      .from('email_messages')
      .select('gmail_message_id')
      .eq('id', draftRecord.reply_to_message_id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    replyMessageGmailId =
      (replyMessage as { gmail_message_id?: string | null } | null)
        ?.gmail_message_id ?? null;
  }

  if (!replyMessageGmailId) {
    const { data: latestMessage } = await auth.client
      .from('email_messages')
      .select('gmail_message_id')
      .eq('thread_id', draftRecord.thread_id)
      .eq('user_id', auth.user.id)
      .order('internal_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    replyMessageGmailId =
      (latestMessage as { gmail_message_id?: string | null } | null)
        ?.gmail_message_id ?? null;
  }

  if (!replyMessageGmailId) {
    return jsonErr(
      'MISSING_REPLY_TARGET',
      'Could not find a Gmail message to reply to',
      400,
    );
  }

  let headers;

  try {
    headers = await loadGmailReplyHeaders(
      auth.user.id,
      replyMessageGmailId,
    );
  } catch (error) {
    return jsonErr(
      'GMAIL_FAILED',
      error instanceof Error ? error.message : 'Could not load reply headers',
      500,
    );
  }

  const ownerEmail =
    (connection as { google_email?: string | null } | null)?.google_email ??
    undefined;
  const raw = buildRawMessage({
    from: ownerEmail,
    to: pickReplyTo(headers.from, headers.to),
    subject: replySubject(draftRecord.subject ?? threadRecord.subject),
    body: bodyText,
    inReplyTo: headers.messageId ?? undefined,
    references: headers.references ?? headers.messageId ?? undefined,
  });

  try {
    const gmailDraft = draftRecord.gmail_draft_id
      ? await updateDraft(auth.user.id, draftRecord.gmail_draft_id, raw)
      : await createDraft(auth.user.id, {
          threadId: threadRecord.gmail_thread_id,
          raw,
        });

    const gmailDraftId = gmailDraft.id ?? draftRecord.gmail_draft_id;

    const { data: updated, error: updateError } = await auth.client
      .from('email_drafts')
      .update({
        body_text: bodyText,
        gmail_draft_id: gmailDraftId,
        status: 'saved_to_gmail',
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .eq('user_id', auth.user.id)
      .select(
        'id, thread_id, reply_to_message_id, subject, body_text, gmail_draft_id, status, model, created_at, updated_at',
      )
      .single();

    if (updateError) {
      return jsonErr('UPDATE_FAILED', updateError.message, 500);
    }

    return jsonOk({ draft: updated, gmailDraftId });
  } catch (error) {
    return jsonErr(
      'GMAIL_FAILED',
      error instanceof Error ? error.message : 'Could not save draft to Gmail',
      500,
    );
  }
}
