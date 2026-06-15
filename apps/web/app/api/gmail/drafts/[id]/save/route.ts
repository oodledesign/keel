import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { saveDraftToGmail } from '~/lib/email-assistant/save-draft-to-gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SaveDraftBody = {
  bodyText?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: draftId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as SaveDraftBody;

  const { data: draftRow, error: draftError } = await auth.client
    .from('email_drafts')
    .select('id')
    .eq('id', draftId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (draftError) {
    return jsonErr('LOAD_FAILED', draftError.message, 500);
  }

  if (!draftRow) {
    return jsonErr('NOT_FOUND', 'Draft not found', 404);
  }

  try {
    const { gmailDraftId } = await saveDraftToGmail({
      userId: auth.user.id,
      draftId,
      bodyText: body.bodyText,
    });

    const { data: updated, error: updateError } = await auth.client
      .from('email_drafts')
      .select(
        'id, thread_id, reply_to_message_id, subject, body_text, gmail_draft_id, status, model, created_at, updated_at',
      )
      .eq('id', draftId)
      .eq('user_id', auth.user.id)
      .single();

    if (updateError) {
      return jsonErr('UPDATE_FAILED', updateError.message, 500);
    }

    return jsonOk({ draft: updated, gmailDraftId });
  } catch (error) {
    return jsonErr(
      'GMAIL_FAILED',
      error instanceof Error ? error.message : 'Could not save draft to Gmail',
      500,
    );
  }
}
