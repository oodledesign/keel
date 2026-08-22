import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadEmailThreadDetailFromDb } from '~/home/(user)/email/_lib/server/email-page.loader';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';
import { resolveEmailAssistantBillingAccountId } from '~/lib/email-assistant/resolve-email-assistant-billing-account';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { suggestPipelineLeadForThread } from '~/lib/email-assistant/suggest-pipeline-lead';
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
  const admin = getSupabaseServerAdminClient();

  const { data: threadRow } = await admin
    .from('email_threads')
    .select('account_id, connection_id')
    .eq('id', threadId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!threadRow) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  const connectionId = (threadRow as { connection_id?: string | null })
    .connection_id;

  let mailboxKind: 'business' | 'personal' = 'business';
  if (connectionId) {
    const { data: connection } = await auth.client
      .from('google_connections')
      .select('mailbox_kind')
      .eq('id', connectionId)
      .maybeSingle();
    const kind = (connection as { mailbox_kind?: string } | null)
      ?.mailbox_kind;
    if (kind === 'personal' || kind === 'business') {
      mailboxKind = kind;
    }
  }

  if (mailboxKind === 'personal') {
    return jsonErr(
      'NOT_SUPPORTED',
      'Pipeline lead suggestions are only available for business mailboxes',
      400,
    );
  }

  const owner = await resolveDraftOwnerContext(auth.user.id, mailboxKind);
  if (!owner) {
    return jsonErr('MISSING_OWNER', 'Could not resolve mailbox owner', 400);
  }

  const billingAccountId = await resolveEmailAssistantBillingAccountId(admin, {
    userId: auth.user.id,
    mailboxKind,
    preferredAccountId: (threadRow as { account_id?: string | null }).account_id,
  });

  try {
    await suggestPipelineLeadForThread(admin, {
      userId: auth.user.id,
      threadId,
      preferredAccountId: (threadRow as { account_id?: string | null }).account_id,
      billingAccountId,
      mailboxKind,
    });
  } catch (error) {
    return jsonErr(
      'SUGGEST_FAILED',
      error instanceof Error ? error.message : 'Could not suggest pipeline lead',
      500,
    );
  }

  const thread = await loadEmailThreadDetailFromDb(threadId);

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  return jsonOk({ thread });
}
