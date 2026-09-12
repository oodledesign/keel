import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { publishMeetingTaskToPlanner } from '~/lib/recorder/publish-meeting-task';
import { buildTaskNotesFromSource } from '~/lib/tasks/build-task-notes-from-source';
import { clampDurationMinutes } from '~/lib/tasks/task-duration';

import { NativeHttpError } from './http';
import {
  type NativeTaskClientRow,
  isPersonalNativeWorkspace,
  nativeClientName,
  parseOptionalClientId,
} from './task-map';
import {
  type NativeTaskReviewAcceptInput,
  type NativeTaskReviewCounts,
  type NativeTaskReviewItem,
  type NativeTaskReviewPayload,
  type NativeTaskReviewSource,
  mergeNativeTaskReviewCounts,
  sortNativeTaskReviewItems,
  toNativeEmailReviewItem,
  toNativeMeetingReviewItem,
} from './task-review-shared';
import type { NativeWorkspace } from './workspace-shared';

export const NATIVE_TASK_REVIEW_LIST_LIMIT = 50;

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export type {
  NativeTaskReviewAcceptInput,
  NativeTaskReviewCounts,
  NativeTaskReviewItem,
  NativeTaskReviewPayload,
  NativeTaskReviewSource,
};

export {
  emptyNativeTaskReviewCounts,
  mergeNativeTaskReviewCounts,
  parseNativeTaskReviewDue,
  parseNativeTaskReviewId,
  parseNativeTaskReviewSource,
  sortNativeTaskReviewItems,
  toNativeEmailReviewItem,
  toNativeMeetingReviewItem,
  unwrapJoinedRow,
} from './task-review-shared';

const EMAIL_LIST_SELECT = `
  id,
  title,
  detail,
  source_excerpt,
  suggested_due_date,
  suggested_duration_minutes,
  thread_id,
  created_at,
  client_id,
  project_id,
  account_id,
  clients:client_id (
    id,
    display_name,
    company_name,
    first_name,
    last_name,
    client_type
  ),
  email_threads:thread_id (
    subject,
    last_message_at,
    client_id,
    project_id
  ),
  projects:project_id (
    id,
    name
  )
`;

const MEETING_LIST_SELECT = `
  id,
  suggested_title,
  suggested_description,
  suggested_due_date,
  suggested_duration_minutes,
  source_excerpt,
  created_at,
  meeting_transcript_id,
  meeting_transcripts:meeting_transcript_id (
    title,
    meeting_date,
    client_id,
    clients:client_id (
      id,
      display_name,
      company_name,
      first_name,
      last_name,
      client_type
    )
  )
`;

function applyEmailAccountFilter<
  T extends {
    or: (filter: string) => T;
    eq: (column: string, value: string) => T;
  },
>(query: T, workspace: NativeWorkspace): T {
  if (isPersonalNativeWorkspace(workspace)) {
    return query.or(
      `account_id.is.null,account_id.eq.${workspace.id}`,
    ) as T;
  }

  return query.eq('account_id', workspace.id) as T;
}

async function requireClientInWorkspace(
  client: SupabaseClient,
  clientId: string,
  accountId: string,
): Promise<void> {
  const { data, error } = await client
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(400, 'client_id must belong to this workspace');
  }
}

async function resolveOptionalClientId(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  value: string | null | undefined,
): Promise<string | null | undefined> {
  const parsed = parseOptionalClientId(value);
  if (parsed) {
    await requireClientInWorkspace(client, parsed, workspace.id);
  }
  return parsed;
}

async function countMeetingReview(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<number> {
  const { count, error } = await client
    .from('meeting_action_items')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', workspace.id)
    .eq('status', 'pending_review');

  if (error) {
    console.error('[native] meeting task review count', error.message);
    return 0;
  }

  return count ?? 0;
}

async function countEmailReview(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
): Promise<number> {
  const { count, error } = await applyEmailAccountFilter(
    client
      .from('email_action_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'suggested'),
    workspace,
  );

  if (error) {
    console.error('[native] email task review count', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function countNativeTaskReview(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
): Promise<NativeTaskReviewCounts> {
  const [meetingCount, emailCount] = await Promise.all([
    countMeetingReview(client, workspace),
    countEmailReview(client, userId, workspace),
  ]);

  return mergeNativeTaskReviewCounts(meetingCount, emailCount);
}

async function loadMeetingReviewItems(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<{ items: NativeTaskReviewItem[]; count: number }> {
  const { data, error, count } = await client
    .from('meeting_action_items')
    .select(MEETING_LIST_SELECT, { count: 'exact' })
    .eq('account_id', workspace.id)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false })
    .limit(NATIVE_TASK_REVIEW_LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return {
    items: (data ?? []).map((row) =>
      toNativeMeetingReviewItem(row as Record<string, unknown>),
    ),
    count: count ?? data?.length ?? 0,
  };
}

async function loadEmailReviewItems(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
): Promise<{ items: NativeTaskReviewItem[]; count: number }> {
  const { data, error, count } = await applyEmailAccountFilter(
    client
      .from('email_action_items')
      .select(EMAIL_LIST_SELECT, { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'suggested')
      .order('created_at', { ascending: false })
      .limit(NATIVE_TASK_REVIEW_LIST_LIMIT),
    workspace,
  );

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row) =>
    toNativeEmailReviewItem(row as Record<string, unknown>),
  );

  await fillMissingEmailNames(client, items);

  return {
    items,
    count: count ?? data?.length ?? 0,
  };
}

async function fillMissingEmailNames(
  client: SupabaseClient,
  items: NativeTaskReviewItem[],
) {
  const missingClientIds = [
    ...new Set(
      items
        .filter((item) => item.client_id && !item.client_name)
        .map((item) => item.client_id as string),
    ),
  ];
  const missingProjectIds = [
    ...new Set(
      items
        .filter((item) => item.project_id && !item.project_name)
        .map((item) => item.project_id as string),
    ),
  ];

  const [clientsResult, projectsResult] = await Promise.all([
    missingClientIds.length > 0
      ? client
          .from('clients')
          .select(
            'id, display_name, company_name, first_name, last_name, client_type',
          )
          .in('id', missingClientIds)
      : Promise.resolve({ data: [] as NativeTaskClientRow[], error: null }),
    missingProjectIds.length > 0
      ? client.from('projects').select('id, name').in('id', missingProjectIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; name?: string | null }>,
          error: null,
        }),
  ]);

  if (clientsResult.error) {
    console.error(
      '[native] task review client names',
      clientsResult.error.message,
    );
  }
  if (projectsResult.error) {
    console.error(
      '[native] task review project names',
      projectsResult.error.message,
    );
  }

  const clientsById = new Map(
    ((clientsResult.data ?? []) as NativeTaskClientRow[]).map((row) => [
      row.id,
      nativeClientName(row),
    ]),
  );
  const projectsById = new Map(
    (projectsResult.data ?? []).map((row) => [
      row.id as string,
      textOrNull(row.name),
    ]),
  );

  for (const item of items) {
    if (item.client_id && !item.client_name) {
      item.client_name = clientsById.get(item.client_id) ?? null;
    }
    if (item.project_id && !item.project_name) {
      item.project_name = projectsById.get(item.project_id) ?? null;
    }
  }
}

export async function listNativeTaskReview(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
  source: NativeTaskReviewSource | 'all' = 'all',
): Promise<NativeTaskReviewPayload> {
  const loadMeetings = source !== 'email';
  const loadEmails = source !== 'meeting';

  const [meetings, emails] = await Promise.all([
    loadMeetings
      ? loadMeetingReviewItems(client, workspace)
      : countMeetingReview(client, workspace).then((count) => ({
          items: [] as NativeTaskReviewItem[],
          count,
        })),
    loadEmails
      ? loadEmailReviewItems(client, userId, workspace)
      : countEmailReview(client, userId, workspace).then((count) => ({
          items: [] as NativeTaskReviewItem[],
          count,
        })),
  ]);

  const counts = mergeNativeTaskReviewCounts(meetings.count, emails.count);

  return {
    ...counts,
    items: sortNativeTaskReviewItems([...meetings.items, ...emails.items]),
  };
}

function mapPublishError(error: unknown): never {
  const message =
    error instanceof Error ? error.message : 'Could not publish suggestion';

  if (/not found|no longer pending|already reviewed/i.test(message)) {
    throw new NativeHttpError(404, message);
  }
  if (/assignee|title is required|workspace member/i.test(message)) {
    throw new NativeHttpError(400, message);
  }

  throw error instanceof Error ? error : new Error(message);
}

export async function acceptNativeTaskReview(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  id: string;
  source: NativeTaskReviewSource;
  patch?: NativeTaskReviewAcceptInput;
}): Promise<{ ok: true; task_id: string }> {
  if (input.source === 'meeting') {
    return acceptMeetingReview(input);
  }

  return acceptEmailReview(input);
}

async function acceptMeetingReview(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  id: string;
  patch?: NativeTaskReviewAcceptInput;
}): Promise<{ ok: true; task_id: string }> {
  const clientId = await resolveOptionalClientId(
    input.client,
    input.workspace,
    input.patch?.clientId,
  );

  let result: { plannerTaskId: string };
  try {
    result = await publishMeetingTaskToPlanner(input.client, {
      meetingActionItemId: input.id,
      accountId: input.workspace.id,
      assigneeId: input.userId,
      reviewedByUserId: input.userId,
      publishSource: 'manual',
      title: input.patch?.title,
      description: input.patch?.detail,
      dueDate: input.patch?.due,
      durationMinutes: input.patch?.durationMinutes,
    });
  } catch (error) {
    mapPublishError(error);
  }

  if (clientId !== undefined) {
    const { error } = await input.client
      .from('tasks')
      .update({ client_id: clientId })
      .eq('id', result.plannerTaskId)
      .eq('account_id', input.workspace.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  return { ok: true, task_id: result.plannerTaskId };
}

async function acceptEmailReview(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  id: string;
  patch?: NativeTaskReviewAcceptInput;
}): Promise<{ ok: true; task_id: string }> {
  const { data: actionItem, error: actionError } = await applyEmailAccountFilter(
    input.client
      .from('email_action_items')
      .select(
        'id, title, detail, source_excerpt, suggested_due_date, suggested_duration_minutes, client_id, project_id, status, account_id',
      )
      .eq('id', input.id)
      .eq('user_id', input.userId),
    input.workspace,
  ).maybeSingle();

  if (actionError) {
    throw new Error(actionError.message);
  }

  if (!actionItem || actionItem.status !== 'suggested') {
    throw new NativeHttpError(404, 'This suggestion is no longer available');
  }

  const accountId = (actionItem.account_id as string | null) ?? null;

  const clientId = await resolveOptionalClientId(
    input.client,
    input.workspace,
    input.patch?.clientId,
  );

  const title =
    input.patch?.title?.trim() ||
    textOrNull(actionItem.title) ||
    'Task';
  const detail =
    input.patch?.detail !== undefined
      ? input.patch.detail
      : ((actionItem.detail as string | null) ?? null);
  const due =
    input.patch?.due !== undefined
      ? input.patch.due
      : ((actionItem.suggested_due_date as string | null) ?? null);
  const durationMinutes = clampDurationMinutes(
    input.patch?.durationMinutes !== undefined
      ? input.patch.durationMinutes
      : (actionItem.suggested_duration_minutes as number | null),
  );
  const resolvedClientId =
    clientId !== undefined
      ? clientId
      : ((actionItem.client_id as string | null) ?? null);

  const insertRow: Record<string, unknown> = {
    user_id: input.userId,
    title,
    notes: buildTaskNotesFromSource({
      description: detail,
      sourceExcerpt: actionItem.source_excerpt as string | null,
      sourceLabel: 'Email',
    }),
    due_date: due,
    duration_minutes: durationMinutes,
    project_id: (actionItem.project_id as string | null) ?? null,
    client_id: resolvedClientId,
    account_id: accountId ?? input.workspace.id,
    status: 'todo',
    priority: 'medium',
    source: 'email',
  };

  let taskResult = await input.client
    .from('tasks')
    .insert(insertRow)
    .select('id')
    .single();

  if (taskResult.error?.message?.includes('source')) {
    const { source: _source, ...withoutSource } = insertRow;
    void _source;
    taskResult = await input.client
      .from('tasks')
      .insert(withoutSource)
      .select('id')
      .single();
  }

  if (taskResult.error || !taskResult.data) {
    throw new Error(taskResult.error?.message ?? 'Could not create task');
  }

  const taskId = (taskResult.data as { id: string }).id;
  const { error: updateError } = await input.client
    .from('email_action_items')
    .update({
      task_id: taskId,
      status: 'accepted',
      title,
      detail,
      suggested_due_date: due,
      suggested_duration_minutes: durationMinutes,
      client_id: resolvedClientId,
    })
    .eq('id', input.id)
    .eq('user_id', input.userId)
    .eq('status', 'suggested');

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { ok: true, task_id: taskId };
}

export async function dismissNativeTaskReview(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  id: string;
  source: NativeTaskReviewSource;
}): Promise<{ ok: true; id: string }> {
  if (input.source === 'meeting') {
    const { data, error } = await input.client
      .from('meeting_action_items')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: input.userId,
      })
      .eq('id', input.id)
      .eq('account_id', input.workspace.id)
      .eq('status', 'pending_review')
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new NativeHttpError(
        404,
        'Suggestion not found or already reviewed',
      );
    }

    return { ok: true, id: data.id as string };
  }

  const { data, error } = await applyEmailAccountFilter(
    input.client
      .from('email_action_items')
      .update({ status: 'dismissed' })
      .eq('id', input.id)
      .eq('user_id', input.userId)
      .eq('status', 'suggested')
      .select('id'),
    input.workspace,
  ).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(404, 'Suggestion not found or already reviewed');
  }

  return { ok: true, id: data.id as string };
}
