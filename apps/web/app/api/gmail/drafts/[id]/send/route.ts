import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import {
  buildSendDraftPreview,
  sendDraftFromOzer,
} from '~/lib/email-assistant/send-draft-from-ozer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: draftId } = await context.params;

  try {
    const preview = await buildSendDraftPreview({
      userId: auth.user.id,
      draftId,
    });
    return jsonOk({ preview });
  } catch (error) {
    return jsonErr(
      'PREVIEW_FAILED',
      error instanceof Error ? error.message : 'Could not build send preview',
      400,
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: draftId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    bodyText?: string;
  };

  try {
    const result = await sendDraftFromOzer({
      userId: auth.user.id,
      draftId,
      bodyText: body.bodyText,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonErr(
      'SEND_FAILED',
      error instanceof Error ? error.message : 'Could not send draft',
      400,
    );
  }
}
