import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { updateEmailThreadLink } from '~/lib/email-assistant/update-thread-link';
import { loadEmailThreadDetailFromDb } from '~/home/(user)/email/_lib/server/email-page.loader';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LinkBody = {
  accountId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as LinkBody;

  const { data: existing, error: existingError } = await auth.client
    .from('email_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existingError) {
    return jsonErr('LOAD_FAILED', existingError.message, 500);
  }

  if (!existing) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  try {
    await updateEmailThreadLink(auth.client, auth.user.id, threadId, {
      accountId: body.accountId ?? null,
      clientId: body.clientId ?? null,
      projectId: body.projectId ?? null,
    });
  } catch (error) {
    return jsonErr(
      'UPDATE_FAILED',
      error instanceof Error ? error.message : 'Could not update link',
      400,
    );
  }

  const thread = await loadEmailThreadDetailFromDb(threadId);

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  return jsonOk({ thread });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: threadId } = await context.params;
  const thread = await loadEmailThreadDetailFromDb(threadId);

  if (!thread) {
    return jsonErr('NOT_FOUND', 'Thread not found', 404);
  }

  return jsonOk({ thread });
}
