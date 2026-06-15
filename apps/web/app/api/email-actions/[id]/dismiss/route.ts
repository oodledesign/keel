import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: actionId } = await context.params;

  const { data: actionItem, error: actionError } = await auth.client
    .from('email_action_items')
    .select('id, status')
    .eq('id', actionId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (actionError) {
    return jsonErr('LOAD_FAILED', actionError.message, 500);
  }

  if (!actionItem) {
    return jsonErr('NOT_FOUND', 'Action item not found', 404);
  }

  if ((actionItem as { status: string }).status !== 'suggested') {
    return jsonErr('INVALID_STATE', 'Action item is not open for dismissal', 409);
  }

  const { data: updated, error: updateError } = await auth.client
    .from('email_action_items')
    .update({ status: 'dismissed' })
    .eq('id', actionId)
    .eq('user_id', auth.user.id)
    .select(
      'id, thread_id, message_id, title, detail, suggested_due_date, status, task_id, created_at',
    )
    .single();

  if (updateError) {
    return jsonErr('UPDATE_FAILED', updateError.message, 500);
  }

  return jsonOk({ actionItem: updated });
}
