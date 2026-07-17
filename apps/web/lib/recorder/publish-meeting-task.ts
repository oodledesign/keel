import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { schedulePublishedTaskIfEnabled } from '~/lib/recorder/schedule-published-task';
import { snapDueDateYmd } from '~/lib/workspace-focus';
import { loadWorkspaceSchedulingSettingsForUser } from '~/lib/workspace-focus/load-workspace-focus-settings';

export {
  HIGH_CONFIDENCE_ASSIGNEE_THRESHOLD,
  LOW_CONFIDENCE_ASSIGNEE_THRESHOLD,
  isHighConfidenceMeetingSuggestion,
} from '~/lib/recorder/meeting-task-confidence';

export type PublishMeetingTaskInput = {
  meetingActionItemId: string;
  accountId: string;
  assigneeId: string;
  reviewedByUserId: string;
  publishSource: 'manual' | 'auto';
  title?: string;
  description?: string | null;
  dueDate?: string | null;
};

export type PublishMeetingTaskResult = {
  plannerTaskId: string;
  status: 'approved' | 'auto_published';
};

type MeetingActionItemRow = {
  id: string;
  account_id: string;
  status: string;
  suggested_title: string;
  suggested_description: string | null;
  suggested_due_date: string | null;
  suggested_assignee_id: string | null;
  source_excerpt: string | null;
  meeting_transcript_id: string;
  meeting_transcripts: {
    client_id: string | null;
    deal_id: string | null;
    title: string | null;
  } | null;
};

async function assertAssigneeIsMember(
  client: SupabaseClient,
  accountId: string,
  assigneeId: string,
) {
  const { data, error } = await client
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('user_id', assigneeId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Assignee must be a workspace member');
  }
}

function buildTaskNotes(
  description: string | null,
  sourceExcerpt: string | null,
): string | null {
  const parts = [
    description?.trim() || null,
    sourceExcerpt?.trim() ? `Meeting excerpt: "${sourceExcerpt.trim()}"` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n\n') : null;
}

export async function publishMeetingTaskToPlanner(
  client: SupabaseClient,
  input: PublishMeetingTaskInput,
): Promise<PublishMeetingTaskResult> {
  const { data: row, error } = await client
    .from('meeting_action_items')
    .select(
      `
      id,
      account_id,
      status,
      suggested_title,
      suggested_description,
      suggested_due_date,
      suggested_assignee_id,
      source_excerpt,
      meeting_transcript_id,
      meeting_transcripts:meeting_transcript_id (
        client_id,
        deal_id,
        title
      )
    `,
    )
    .eq('id', input.meetingActionItemId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!row) {
    throw new Error('Suggestion not found');
  }

  const item = row as unknown as MeetingActionItemRow;

  if (item.status !== 'pending_review') {
    throw new Error('This suggestion is no longer pending review');
  }

  const assigneeId = input.assigneeId.trim();
  if (!assigneeId) {
    throw new Error('An assignee is required before publishing');
  }

  await assertAssigneeIsMember(client, input.accountId, assigneeId);

  const admin = getSupabaseServerAdminClient();
  const scheduling = await loadWorkspaceSchedulingSettingsForUser(
    admin,
    input.accountId,
    assigneeId,
  );

  const title = input.title?.trim() || item.suggested_title.trim();
  if (!title) {
    throw new Error('Task title is required');
  }

  const description =
    input.description !== undefined
      ? input.description
      : item.suggested_description;
  const dueDateWasExplicit = input.dueDate !== undefined;
  let dueDate = dueDateWasExplicit ? input.dueDate : item.suggested_due_date;
  if (dueDate && !dueDateWasExplicit) {
    dueDate = snapDueDateYmd(dueDate, scheduling);
  }

  const transcript = item.meeting_transcripts;
  const clientId = transcript?.client_id ?? null;

  const insertRow: Record<string, unknown> = {
    user_id: assigneeId,
    account_id: input.accountId,
    title,
    notes: buildTaskNotes(description, item.source_excerpt),
    due_date: dueDate,
    client_id: clientId,
    status: 'todo',
    priority: 'medium',
    source: 'meeting',
  };

  let taskResult = await client
    .from('tasks')
    .insert(insertRow)
    .select('id')
    .single();

  if (taskResult.error?.message?.includes('source')) {
    const { source: _source, ...withoutSource } = insertRow;
    void _source;
    taskResult = await client
      .from('tasks')
      .insert(withoutSource)
      .select('id')
      .single();
  }

  if (taskResult.error || !taskResult.data) {
    throw new Error(
      taskResult.error?.message ?? 'Could not create planner task',
    );
  }

  const plannerTaskId = (taskResult.data as { id: string }).id;
  const status = input.publishSource === 'auto' ? 'auto_published' : 'approved';

  const { error: updateError } = await client
    .from('meeting_action_items')
    .update({
      status,
      planner_task_id: plannerTaskId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.reviewedByUserId,
      suggested_title: title,
      suggested_description: description,
      suggested_due_date: dueDate,
      suggested_assignee_id: assigneeId,
    })
    .eq('id', item.id)
    .eq('account_id', input.accountId)
    .eq('status', 'pending_review');

  if (updateError) {
    throw new Error(updateError.message);
  }

  try {
    await schedulePublishedTaskIfEnabled(client, {
      accountId: input.accountId,
      taskId: plannerTaskId,
      assigneeUserId: assigneeId,
      title,
      dueDate,
    });
  } catch (error) {
    console.error('[recorder] auto-schedule after publish failed', {
      meetingActionItemId: input.meetingActionItemId,
      plannerTaskId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { plannerTaskId, status };
}
