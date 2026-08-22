import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { suggestEmailThreadLink } from '~/lib/email-assistant/auto-link-thread';
import { resolveDraftOwnerContext } from '~/lib/email-assistant/draft-owner';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { loadEmailThreadDetailFromDb } from '~/home/(user)/email/_lib/server/email-page.loader';

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
  const owner = await resolveDraftOwnerContext(auth.user.id);

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
