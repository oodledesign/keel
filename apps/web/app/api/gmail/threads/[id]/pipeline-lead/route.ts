import { loadEmailThreadDetailFromDb } from '~/home/(user)/email/_lib/server/email-page.loader';
import { createPipelineLeadFromThread } from '~/lib/email-assistant/create-pipeline-lead-from-thread';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    accountSlug?: string;
  };

  try {
    const result = await createPipelineLeadFromThread(auth.client, {
      userId: auth.user.id,
      threadId,
      accountSlug: body.accountSlug,
    });

    const thread = await loadEmailThreadDetailFromDb(threadId);

    return jsonOk({
      dealId: result.dealId,
      accountSlug: result.accountSlug,
      thread,
    });
  } catch (error) {
    return jsonErr(
      'CREATE_FAILED',
      error instanceof Error ? error.message : 'Could not create pipeline lead',
      400,
    );
  }
}
