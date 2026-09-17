import type { SupabaseClient } from '@supabase/supabase-js';

import { clampDurationMinutes } from '~/lib/tasks/task-duration';

/** Suggested meeting tasks waiting in the shared review pool. */
export const MEETING_SUGGESTED_TASK_PENDING_STATUS = 'pending_review';

/** Statuses the workspace meeting page (and list badges) treat as extracted. */
export const MEETING_VISIBLE_SUGGESTED_TASK_STATUSES = [
  MEETING_SUGGESTED_TASK_PENDING_STATUS,
  'approved',
  'auto_published',
] as const;

/** Published tasks that may appear on public / portal meeting pages. */
export const MEETING_PUBLISHED_SUGGESTED_TASK_STATUSES = [
  'approved',
  'auto_published',
] as const;

export const MEETING_SUGGESTED_TASK_COLUMNS =
  'id, meeting_transcript_id, suggested_title, suggested_description, suggested_due_date, suggested_duration_minutes, suggested_assignee_id, assignee_confidence, source_excerpt, status, planner_task_id, created_at';

export type MeetingSuggestedTaskRow = {
  id: string;
  meeting_transcript_id: string;
  suggested_title: string;
  suggested_description: string | null;
  suggested_due_date: string | null;
  suggested_duration_minutes: number | null;
  suggested_assignee_id: string | null;
  assignee_confidence: number | null;
  source_excerpt: string | null;
  status: string;
  planner_task_id: string | null;
  created_at: string;
};

export type MeetingSuggestedTaskInsert = {
  suggestedTitle: string;
  suggestedDescription: string | null;
  suggestedDueDate: string | null;
  suggestedDurationMinutes: number | null;
  suggestedAssigneeId: string | null;
  sourceExcerpt?: string | null;
};

function mapSuggestedTaskRow(
  row: Record<string, unknown>,
): MeetingSuggestedTaskRow {
  return {
    id: String(row.id),
    meeting_transcript_id: String(row.meeting_transcript_id),
    suggested_title: String(row.suggested_title ?? ''),
    suggested_description: (row.suggested_description as string | null) ?? null,
    suggested_due_date: (row.suggested_due_date as string | null) ?? null,
    suggested_duration_minutes:
      typeof row.suggested_duration_minutes === 'number'
        ? row.suggested_duration_minutes
        : null,
    suggested_assignee_id: (row.suggested_assignee_id as string | null) ?? null,
    assignee_confidence:
      typeof row.assignee_confidence === 'number'
        ? row.assignee_confidence
        : null,
    source_excerpt: (row.source_excerpt as string | null) ?? null,
    status: String(row.status ?? ''),
    planner_task_id: (row.planner_task_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

export function normalizeSuggestedTaskTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isDuplicateSuggestedTaskTitle(
  title: string,
  existingTitles: Iterable<string>,
) {
  const normalized = normalizeSuggestedTaskTitle(title);
  if (!normalized) return false;

  for (const existing of existingTitles) {
    if (normalizeSuggestedTaskTitle(existing) === normalized) {
      return true;
    }
  }

  return false;
}

export async function listMeetingSuggestedTasks(
  client: SupabaseClient,
  input: {
    accountId: string;
    meetingTranscriptId?: string;
    statuses?: readonly string[];
    limit?: number;
    newestFirst?: boolean;
  },
): Promise<MeetingSuggestedTaskRow[]> {
  let query = client
    .from('meeting_action_items')
    .select(MEETING_SUGGESTED_TASK_COLUMNS)
    .eq('account_id', input.accountId)
    .in(
      'status',
      input.statuses
        ? [...input.statuses]
        : [...MEETING_VISIBLE_SUGGESTED_TASK_STATUSES],
    );

  if (input.meetingTranscriptId) {
    query = query.eq('meeting_transcript_id', input.meetingTranscriptId);
  }

  query = query.order('created_at', { ascending: !input.newestFirst });

  if (input.limit) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(
    mapSuggestedTaskRow,
  );
}

export async function listPendingMeetingSuggestedTasks(
  client: SupabaseClient,
  input: { accountId: string; meetingTranscriptId?: string; limit?: number },
): Promise<MeetingSuggestedTaskRow[]> {
  return listMeetingSuggestedTasks(client, {
    ...input,
    statuses: [MEETING_SUGGESTED_TASK_PENDING_STATUS],
    newestFirst: !input.meetingTranscriptId,
  });
}

export async function meetingHasPendingSuggestedTasks(
  client: SupabaseClient,
  input: { accountId: string; meetingTranscriptId: string },
): Promise<boolean> {
  const { count, error } = await client
    .from('meeting_action_items')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', input.accountId)
    .eq('meeting_transcript_id', input.meetingTranscriptId)
    .eq('status', MEETING_SUGGESTED_TASK_PENDING_STATUS);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function insertPendingMeetingSuggestedTasks(
  client: SupabaseClient,
  input: {
    accountId: string;
    meetingTranscriptId: string;
    items: MeetingSuggestedTaskInsert[];
  },
): Promise<MeetingSuggestedTaskRow[]> {
  if (input.items.length === 0) {
    return [];
  }

  const rows = input.items.map((item) => ({
    account_id: input.accountId,
    meeting_transcript_id: input.meetingTranscriptId,
    suggested_title: item.suggestedTitle.trim(),
    suggested_description: item.suggestedDescription?.trim() || null,
    suggested_due_date: item.suggestedDueDate || null,
    suggested_duration_minutes: clampDurationMinutes(
      item.suggestedDurationMinutes,
    ),
    suggested_assignee_id: item.suggestedAssigneeId,
    source_excerpt: item.sourceExcerpt?.trim() || null,
    status: MEETING_SUGGESTED_TASK_PENDING_STATUS,
  }));

  const { data, error } = await client
    .from('meeting_action_items')
    .insert(rows)
    .select(MEETING_SUGGESTED_TASK_COLUMNS);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(
    mapSuggestedTaskRow,
  );
}

/**
 * Persist new meeting-page extracts into the shared review pool, skipping
 * titles that already exist for this meeting (any visible status).
 */
export async function mergeNewMeetingSuggestedTasks(
  client: SupabaseClient,
  input: {
    accountId: string;
    meetingTranscriptId: string;
    items: MeetingSuggestedTaskInsert[];
  },
): Promise<{ inserted: MeetingSuggestedTaskRow[]; skippedDuplicates: number }> {
  const existing = await listMeetingSuggestedTasks(client, {
    accountId: input.accountId,
    meetingTranscriptId: input.meetingTranscriptId,
    statuses: [...MEETING_VISIBLE_SUGGESTED_TASK_STATUSES],
  });
  const existingTitles = existing.map((row) => row.suggested_title);

  const uniqueItems = input.items.filter(
    (item) =>
      !isDuplicateSuggestedTaskTitle(item.suggestedTitle, existingTitles),
  );

  if (uniqueItems.length === 0) {
    return { inserted: [], skippedDuplicates: input.items.length };
  }

  const inserted = await insertPendingMeetingSuggestedTasks(client, {
    accountId: input.accountId,
    meetingTranscriptId: input.meetingTranscriptId,
    items: uniqueItems,
  });

  return {
    inserted,
    skippedDuplicates: input.items.length - uniqueItems.length,
  };
}
