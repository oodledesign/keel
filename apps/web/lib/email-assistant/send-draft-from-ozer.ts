import 'server-only';

import { sendDraft, syncGmailThread } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

import { setEmailThreadCategory } from './set-thread-category';
import { loadGmailReplyHeaders } from './gmail-reply-headers';
import {
  buildReplyAllRecipients,
  saveDraftToGmail,
} from './save-draft-to-gmail';

function replySubject(subject: string | null | undefined) {
  const trimmed = subject?.trim();

  if (!trimmed) {
    return 'Re: (no subject)';
  }

  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export type SendDraftPreview = {
  from: string;
  to: string;
  cc?: string;
  subject: string;
};

export async function buildSendDraftPreview(input: {
  userId: string;
  draftId: string;
  bodyText?: string;
}): Promise<SendDraftPreview> {
  const admin = getSupabaseServerAdminClient();

  const { data: draftRow, error } = await admin
    .from('email_drafts')
    .select('id, user_id, thread_id, subject, body_text')
    .eq('id', input.draftId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!draftRow) {
    throw new Error('Draft not found');
  }

  const { data: thread } = await admin
    .from('email_threads')
    .select('id, subject, connection_id')
    .eq('id', draftRow.thread_id as string)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (!thread) {
    throw new Error('Thread not found');
  }

  const { data: connection } = await admin
    .from('google_connections')
    .select('google_email, mailbox_kind')
    .eq('id', (thread as { connection_id?: string }).connection_id ?? '')
    .maybeSingle();

  const mailboxKind =
    (connection as { mailbox_kind?: string } | null)?.mailbox_kind ===
    'personal'
      ? 'personal'
      : 'business';

  const { data: latestMessage } = await admin
    .from('email_messages')
    .select('gmail_message_id')
    .eq('thread_id', draftRow.thread_id as string)
    .eq('user_id', input.userId)
    .order('internal_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const gmailMessageId = (
    latestMessage as { gmail_message_id?: string | null } | null
  )?.gmail_message_id;

  if (!gmailMessageId) {
    throw new Error('Could not find a Gmail message to reply to');
  }

  const headers = await loadGmailReplyHeaders(
    input.userId,
    gmailMessageId,
    mailboxKind,
  );

  const ownerEmail =
    (connection as { google_email?: string | null } | null)?.google_email ?? '';

  const recipients = buildReplyAllRecipients({
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    ownerEmail,
  });

  return {
    from: ownerEmail,
    to: recipients.to,
    cc: recipients.cc,
    subject: replySubject(
      (draftRow.subject as string | null) ?? (thread.subject as string | null),
    ),
  };
}

export async function sendDraftFromOzer(input: {
  userId: string;
  draftId: string;
  bodyText?: string;
}): Promise<{ gmailMessageId: string | null }> {
  const admin = getSupabaseServerAdminClient();

  const { data: settings } = await admin
    .from('email_assistant_settings')
    .select('allow_send_from_ozer, connection_id')
    .eq('user_id', input.userId)
    .limit(1)
    .maybeSingle();

  if (!(settings as { allow_send_from_ozer?: boolean } | null)?.allow_send_from_ozer) {
    throw new Error('Send from Ozer is disabled in email settings');
  }

  const { gmailDraftId } = await saveDraftToGmail({
    userId: input.userId,
    draftId: input.draftId,
    bodyText: input.bodyText,
  });

  const { data: draftRow } = await admin
    .from('email_drafts')
    .select('thread_id')
    .eq('id', input.draftId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (!draftRow) {
    throw new Error('Draft not found');
  }

  const { data: threadForConnection } = await admin
    .from('email_threads')
    .select('connection_id, gmail_thread_id')
    .eq('id', draftRow.thread_id as string)
    .eq('user_id', input.userId)
    .maybeSingle();

  const { data: connection } = await admin
    .from('google_connections')
    .select('mailbox_kind')
    .eq('id', (threadForConnection as { connection_id?: string }).connection_id ?? '')
    .maybeSingle();

  const mailboxKind =
    (connection as { mailbox_kind?: string } | null)?.mailbox_kind ===
    'personal'
      ? 'personal'
      : 'business';

  const sent = await sendDraft(input.userId, gmailDraftId, mailboxKind);
  const gmailMessageId = sent.message?.id ?? null;
  const threadId = draftRow.thread_id as string;

  await admin
    .from('email_drafts')
    .update({
      status: 'sent',
      gmail_message_id: gmailMessageId,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.draftId)
    .eq('user_id', input.userId);

  await setEmailThreadCategory(
    admin,
    input.userId,
    threadId,
    'waiting',
    'Reply sent from Ozer',
    { confidence: 1 },
  );

  const { data: thread } = await admin
    .from('email_threads')
    .select('gmail_thread_id')
    .eq('id', threadId)
    .maybeSingle();

  const gmailThreadId = (threadForConnection as { gmail_thread_id?: string } | null)
    ?.gmail_thread_id ?? (thread as { gmail_thread_id?: string } | null)?.gmail_thread_id;

  if (gmailThreadId) {
    try {
      await syncGmailThread(input.userId, gmailThreadId, {
        format: 'metadata',
        mailboxKind,
      });
    } catch {
      // Best-effort sync after send.
    }
  }

  queueEmailThreadBrainSync(threadId);

  return { gmailMessageId };
}
