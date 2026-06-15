import { draft } from '@kit/email-assistant';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { buildThreadText } from '~/lib/email-assistant/thread-text';
import { requireApiUser } from '~/lib/email-assistant/require-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;

  const [{ data: thread, error: threadError }, { data: settings }] =
    await Promise.all([
      auth.client
        .from('email_threads')
        .select('id, user_id, subject')
        .eq('id', threadId)
        .eq('user_id', auth.user.id)
        .maybeSingle(),
      auth.client
        .from('email_assistant_settings')
        .select('style_notes, signature')
        .eq('user_id', auth.user.id)
        .maybeSingle(),
    ]);

  if (threadError) {
    return jsonErr('LOAD_FAILED', threadError.message, 500);
  }

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const { data: messages, error: messagesError } = await auth.client
    .from('email_messages')
    .select(
      'id, from_address, subject, body_text, snippet, internal_date, created_at',
    )
    .eq('thread_id', threadId)
    .eq('user_id', auth.user.id)
    .order('internal_date', { ascending: true, nullsFirst: false });

  if (messagesError) {
    return jsonErr('LOAD_FAILED', messagesError.message, 500);
  }

  const threadText = buildThreadText(messages ?? []);

  if (!threadText.trim()) {
    return jsonErr('EMPTY_THREAD', 'Thread has no message content to reply to', 400);
  }

  let bodyText: string;

  try {
    bodyText = await draft(
      threadText,
      (settings as { style_notes?: string | null } | null)?.style_notes ?? null,
      (settings as { signature?: string | null } | null)?.signature ?? null,
    );
  } catch (error) {
    return jsonErr(
      'DRAFT_FAILED',
      error instanceof Error ? error.message : 'Draft generation failed',
      500,
    );
  }

  const latestMessageId =
    (messages?.at(-1) as { id?: string } | undefined)?.id ?? null;
  const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

  const { data: inserted, error: insertError } = await auth.client
    .from('email_drafts')
    .insert({
      user_id: auth.user.id,
      thread_id: threadId,
      reply_to_message_id: latestMessageId,
      subject: (thread as { subject?: string | null }).subject ?? null,
      body_text: bodyText,
      status: 'draft',
      model,
    })
    .select(
      'id, thread_id, reply_to_message_id, subject, body_text, gmail_draft_id, status, model, created_at, updated_at',
    )
    .single();

  if (insertError) {
    return jsonErr('INSERT_FAILED', insertError.message, 500);
  }

  return jsonOk({ draft: inserted });
}
