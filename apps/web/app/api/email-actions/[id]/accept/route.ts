import type { SupabaseClient } from '@supabase/supabase-js';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AcceptBody = {
  projectId?: string | null;
  clientId?: string | null;
};

async function insertTaskForActionItem(input: {
  client: SupabaseClient;
  userId: string;
  title: string;
  detail: string | null;
  suggestedDueDate: string | null;
  projectId?: string | null;
  clientId?: string | null;
}) {
  const insertRow: Record<string, unknown> = {
    user_id: input.userId,
    title: input.title,
    notes: input.detail,
    due_date: input.suggestedDueDate,
    project_id: input.projectId ?? null,
    client_id: input.clientId ?? null,
    status: 'todo',
    priority: 'medium',
    source: 'email',
  };

  let result = await input.client
    .from('tasks')
    .insert(insertRow)
    .select('id')
    .single();

  if (result.error?.message?.includes('source')) {
    const { source: _source, ...withoutSource } = insertRow;
    void _source;
    result = await input.client
      .from('tasks')
      .insert(withoutSource)
      .select('id')
      .single();
  }

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'Could not create task');
  }

  return (result.data as { id: string }).id;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { id: actionId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as AcceptBody;

  const { data: actionItem, error: actionError } = await auth.client
    .from('email_action_items')
    .select('id, user_id, title, detail, suggested_due_date, status, task_id')
    .eq('id', actionId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (actionError) {
    return jsonErr('LOAD_FAILED', actionError.message, 500);
  }

  if (!actionItem) {
    return jsonErr('NOT_FOUND', 'Action item not found', 404);
  }

  const item = actionItem as {
    id: string;
    title: string;
    detail: string | null;
    suggested_due_date: string | null;
    status: string;
    task_id: string | null;
  };

  if (item.status !== 'suggested') {
    return jsonErr('INVALID_STATE', 'Action item is not open for acceptance', 409);
  }

  let taskId: string;

  try {
    taskId = await insertTaskForActionItem({
      client: auth.client,
      userId: auth.user.id,
      title: item.title,
      detail: item.detail,
      suggestedDueDate: item.suggested_due_date,
      projectId: body.projectId ?? null,
      clientId: body.clientId ?? null,
    });
  } catch (error) {
    return jsonErr(
      'TASK_CREATE_FAILED',
      error instanceof Error ? error.message : 'Could not create task',
      500,
    );
  }

  const { data: updated, error: updateError } = await auth.client
    .from('email_action_items')
    .update({
      task_id: taskId,
      status: 'accepted',
    })
    .eq('id', actionId)
    .eq('user_id', auth.user.id)
    .select(
      'id, thread_id, message_id, title, detail, suggested_due_date, status, task_id, created_at',
    )
    .single();

  if (updateError) {
    return jsonErr('UPDATE_FAILED', updateError.message, 500);
  }

  return jsonOk({ actionItem: updated, taskId });
}
