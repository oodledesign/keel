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

async function resolveThreadMailboxKind(
  userId: string,
  threadId: string,
): Promise<MailboxKind> {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin
    .from('email_threads')
    .select('connection_id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  const connectionId = (data as { connection_id?: string | null } | null)
    ?.connection_id;
  if (!connectionId) {
    return 'business';
  }

  const { data: connection } = await admin
    .from('google_connections')
    .select('mailbox_kind')
    .eq('id', connectionId)
    .maybeSingle();

  const kind = (connection as { mailbox_kind?: string | null } | null)
    ?.mailbox_kind;
  return kind === 'personal' ? 'personal' : 'business';
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;
  const mailboxKind = await resolveThreadMailboxKind(auth.user.id, threadId);
  const owner = await resolveDraftOwnerContext(auth.user.id, mailboxKind);

  if (!owner) {
    return jsonErr('MISSING_OWNER', 'Could not resolve mailbox owner', 400);
  }

  const admin = getSupabaseServerAdminClient();

  try {
    await suggestEmailThreadLink(admin, auth.user.id, threadId, owner.email);
  } catch (error) {
    return jsonErr(
      'SUGGEST_FAILED',
      error instanceof Error ? error.message : 'Could not suggest link',
      500,
    );
  }

  const thread = await loadEmailThreadDetailFromDb(threadId);

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  return jsonOk({ thread });
}
