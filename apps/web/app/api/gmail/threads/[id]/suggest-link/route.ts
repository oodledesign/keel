import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadEmailThreadDetailFromDb } from '~/home/(user)/email/_lib/server/email-page.loader';
import { suggestEmailThreadLink } from '~/lib/email-assistant/auto-link-thread';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';
import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

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

  const { data: threadRow, error: threadError } = await auth.client
    .from('email_threads')
    .select('id, account_id, connection_id')
    .eq('id', threadId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (threadError) {
    return jsonErr('LOAD_FAILED', threadError.message, 500);
  }

  if (!threadRow) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const connectionId = (threadRow as { connection_id?: string | null })
    .connection_id;

  let mailboxKind: MailboxKind = 'business';
  if (connectionId) {
    const { data: connection } = await auth.client
      .from('google_connections')
      .select('mailbox_kind')
      .eq('id', connectionId)
      .maybeSingle();
    const kind = (connection as { mailbox_kind?: string } | null)?.mailbox_kind;
    if (kind === 'personal' || kind === 'business') {
      mailboxKind = kind;
    }
  }

  const owner = await resolveDraftOwnerContext(auth.user.id, mailboxKind, {
    connectionId,
    fallbackEmail: auth.user.email,
  });

  if (!owner) {
    return jsonErr(
      'MISSING_OWNER',
      'Could not determine your mailbox email for link suggestions',
      400,
    );
  }

  const admin = getSupabaseServerAdminClient();
  const preferredAccountId = (threadRow as { account_id?: string | null })
    .account_id;

  try {
    await suggestEmailThreadLink(admin, auth.user.id, threadId, owner.email, {
      preferredAccountId,
    });
  } catch (error) {
    const logger = await getLogger();
    logger.error(
      {
        name: 'gmail.suggest-link',
        threadId,
        userId: auth.user.id,
        error: error instanceof Error ? error.message : error,
      },
      'Failed to suggest email thread link',
    );

    return jsonErr(
      'SUGGEST_FAILED',
      error instanceof Error ? error.message : 'Could not suggest link',
      500,
    );
  }

  const thread = await loadEmailThreadDetailFromDb(threadId, auth.user.id);

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  return jsonOk({ thread });
}
