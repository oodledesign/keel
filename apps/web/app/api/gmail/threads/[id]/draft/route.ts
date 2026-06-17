import { draft } from '@kit/email-assistant';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { buildThreadText } from '~/lib/email-assistant/thread-text';
import { resolveEmailAssistantSignature } from '~/lib/email-assistant/resolve-signature';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;

  const [
    { data: thread, error: threadError },
    { data: settings },
    { data: connection },
    { data: account },
  ] = await Promise.all([
    auth.client
      .from('email_threads')
      .select('id, user_id, subject')
      .eq('id', threadId)
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    auth.client
      .from('email_assistant_settings')
      .select('style_notes, signature, signature_is_html')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    auth.client
      .from('google_connections')
      .select('google_email')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    auth.client
      .from('accounts')
      .select('name, email')
      .eq('id', auth.user.id)
      .maybeSingle(),
  ]);

  if (threadError) {
    return jsonErr('LOAD_FAILED', threadError.message, 500);
  }

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const ownerEmail =
    (connection as { google_email?: string | null } | null)?.google_email?.trim() ||
    auth.user.email?.trim() ||
    (account as { email?: string | null } | null)?.email?.trim() ||
    '';

  if (!ownerEmail) {
    return jsonErr(
      'MISSING_OWNER',
      'Could not determine your mailbox email for drafting',
      400,
    );
  }

  const ownerName =
    (account as { name?: string | null } | null)?.name?.trim() ||
    (() => {
      const meta = auth.user.user_metadata as Record<string, unknown> | undefined;
      for (const key of ['full_name', 'name'] as const) {
        const value = meta?.[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return null;
    })();

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

  const signature = await resolveEmailAssistantSignature(
    auth.user.id,
    (settings as { signature?: string | null } | null)?.signature ?? null,
    Boolean(
      (settings as { signature_is_html?: boolean | null } | null)
        ?.signature_is_html,
    ),
  );

  let bodyText: string;

  try {
    bodyText = await draft(
      threadText,
      { email: ownerEmail, displayName: ownerName },
      (settings as { style_notes?: string | null } | null)?.style_notes ?? null,
      signature.plain,
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
  const model = resolveAnthropicModel();

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
