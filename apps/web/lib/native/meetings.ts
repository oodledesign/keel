import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueBrainIndexSource } from '~/lib/brain/sync';
import { loadMeetingSummary } from '~/lib/recorder/meeting-summary';
import { parseTranscriptContent } from '~/lib/recorder/transcript-speakers';

import { NativeHttpError } from './http';
import {
  type NativeMeeting,
  type NativeMeetingDetail,
  type NativeMeetingListItem,
  type NativeMeetingRow,
  type NativeMeetingTask,
  type NativeUpcomingMeeting,
  nativeMeetingClientName,
  normalizeNativeMeetingContent,
  parseNativeMeetingDate,
  parseNativeMeetingSource,
  toNativeMeeting,
} from './meetings-shared';
import type { NativeTaskClientRow } from './task-map';
import { parseOptionalClientId } from './task-map';
import { type NativeWorkspace, isUuid } from './workspace-shared';

export type {
  NativeMeeting,
  NativeMeetingDetail,
  NativeMeetingListItem,
  NativeUpcomingMeeting,
} from './meetings-shared';
export {
  normalizeNativeMeetingContent,
  parseNativeMeetingDate,
  parseNativeMeetingSource,
  toNativeMeeting,
} from './meetings-shared';

const LIST_LIMIT = 100;

/** Keep `content` so existing phones can open a transcript from the hub payload. */
const LIST_SELECT =
  'id, title, content, client_id, meeting_date, source, duration_seconds, created_at, updated_at';

const UPCOMING_LIMIT = 8;

async function requireClientInWorkspace(
  client: SupabaseClient,
  clientId: string,
  accountId: string,
): Promise<NativeTaskClientRow> {
  const { data, error } = await client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(400, 'client_id must belong to this workspace');
  }

  return data as NativeTaskClientRow;
}

async function loadClientRows(
  client: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, NativeTaskClientRow>> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .in('id', unique);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, NativeTaskClientRow>();
  for (const row of (data ?? []) as NativeTaskClientRow[]) {
    map.set(row.id, row);
  }
  return map;
}

function insertFailed(
  error: {
    message?: string;
    code?: string;
  } | null,
): never {
  const message = error?.message ?? 'Failed to create meeting transcript';
  if (
    error?.code === '42501' ||
    /row-level security|permission denied|policy/i.test(message)
  ) {
    throw new NativeHttpError(
      403,
      'You cannot save meetings in this workspace',
    );
  }
  if (
    error?.code === '23514' ||
    /client_or_deal|a client or deal/i.test(message)
  ) {
    throw new NativeHttpError(400, 'A client is required');
  }
  if (/source/i.test(message) && /check/i.test(message)) {
    throw new NativeHttpError(400, 'Invalid meeting source');
  }
  throw new Error(message);
}

async function loadExtractedTranscriptIds(
  client: SupabaseClient,
  accountId: string,
  transcriptIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(transcriptIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Set();
  }

  const { data, error } = await client
    .from('meeting_action_items')
    .select('meeting_transcript_id')
    .eq('account_id', accountId)
    .in('meeting_transcript_id', unique)
    .in('status', ['pending_review', 'approved', 'auto_published']);

  if (error) {
    throw new Error(error.message);
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { meeting_transcript_id?: string })
      .meeting_transcript_id;
    if (id) ids.add(id);
  }
  return ids;
}

function bookingTitle(row: Record<string, unknown>): string {
  const eventTypes = row.event_types as
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null;
  const pages = row.booking_pages as
    | { title?: string | null }
    | Array<{ title?: string | null }>
    | null;
  const eventTypeName = Array.isArray(eventTypes)
    ? (eventTypes[0]?.name ?? null)
    : (eventTypes?.name ?? null);
  const pageTitle = Array.isArray(pages)
    ? (pages[0]?.title ?? null)
    : (pages?.title ?? null);

  return (
    eventTypeName?.trim() ||
    pageTitle?.trim() ||
    (row.invitee_name as string | null)?.trim() ||
    'Meeting'
  );
}

export async function listNativeUpcomingMeetings(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeUpcomingMeeting[]> {
  try {
    const { data, error } = await client
      .from('bookings')
      .select(
        'id, start_at, invitee_name, conferencing_url, status, event_types(name), booking_pages(title)',
      )
      .eq('account_id', workspace.id)
      .eq('status', 'confirmed')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(UPCOMING_LIMIT);

    if (error) {
      console.warn('[native/meetings] load upcoming bookings failed', error);
      return [];
    }

    const now = Date.now();
    return ((data ?? []) as Record<string, unknown>[])
      .filter((row) => {
        const start = Date.parse(String(row.start_at ?? ''));
        return !Number.isNaN(start) && start >= now;
      })
      .slice(0, UPCOMING_LIMIT)
      .map((row) => ({
        id: String(row.id),
        title: bookingTitle(row),
        start_at: String(row.start_at),
        invitee_name: String(row.invitee_name ?? '').trim() || 'Guest',
        conferencing_url:
          typeof row.conferencing_url === 'string' &&
          row.conferencing_url.trim()
            ? row.conferencing_url.trim()
            : null,
      }));
  } catch (error) {
    console.warn('[native/meetings] load upcoming bookings failed', error);
    return [];
  }
}

export async function listNativeMeetings(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeMeetingListItem[]> {
  const { data, error } = await client
    .from('meeting_transcripts')
    .select(LIST_SELECT)
    .eq('account_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as NativeMeetingRow[];
  const [names, extracted] = await Promise.all([
    loadClientRows(
      client,
      rows.map((row) => row.client_id ?? '').filter(Boolean),
    ),
    loadExtractedTranscriptIds(
      client,
      workspace.id,
      rows.map((row) => row.id),
    ),
  ]);

  return rows.map((row) => ({
    ...toNativeMeeting(
      row,
      workspace,
      nativeMeetingClientName(row.client_id ? names.get(row.client_id) : null),
    ),
    has_extracted_tasks: extracted.has(row.id),
  }));
}

export async function loadNativeMeetingsHub(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<{
  items: NativeMeetingListItem[];
  upcoming: NativeUpcomingMeeting[];
}> {
  const [items, upcoming] = await Promise.all([
    listNativeMeetings(client, workspace),
    listNativeUpcomingMeetings(client, workspace),
  ]);
  return { items, upcoming };
}

export async function createNativeMeeting(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  title?: string | null;
  content: string;
  clientId?: string | null;
  meetingDate?: string | null;
  source?: string | null;
  durationSeconds?: number | null;
}): Promise<NativeMeeting> {
  const content = normalizeNativeMeetingContent(input.content);
  if (!content) {
    throw new NativeHttpError(400, 'content is required');
  }

  const clientId = parseOptionalClientId(input.clientId ?? undefined) ?? null;
  if (!clientId) {
    throw new NativeHttpError(400, 'A client is required');
  }

  const clientRow = await requireClientInWorkspace(
    input.client,
    clientId,
    input.workspace.id,
  );

  const parsed = parseTranscriptContent(content);
  const speakerSegments = parsed.hasSpeakerLabels ? parsed.segments : null;
  const source = parseNativeMeetingSource(input.source);
  const meetingDate = parseNativeMeetingDate(input.meetingDate);
  const title = input.title?.trim() || 'Meeting transcript';
  const duration =
    typeof input.durationSeconds === 'number' &&
    Number.isFinite(input.durationSeconds) &&
    input.durationSeconds >= 0
      ? Math.round(input.durationSeconds)
      : null;

  const { data, error } = await input.client
    .from('meeting_transcripts')
    .insert({
      account_id: input.workspace.id,
      client_id: clientId,
      deal_id: null,
      title,
      content,
      speaker_segments: speakerSegments,
      source,
      meeting_date: meetingDate,
      created_by: input.userId,
      duration_seconds: duration,
      recorded_at: new Date().toISOString(),
    })
    .select(LIST_SELECT)
    .single();

  if (error || !data) {
    insertFailed(error);
  }

  const row = data as NativeMeetingRow;
  queueBrainIndexSource(input.workspace.id, 'transcript', row.id);

  return toNativeMeeting(
    row,
    input.workspace,
    nativeMeetingClientName(clientRow),
  );
}

async function loadWorkspaceMemberNames(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  assigneeIds: Set<string>,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const slug = workspace.slug.trim();
  if (assigneeIds.size === 0 || !slug) {
    return names;
  }

  const { data, error } = await client.rpc('get_account_members', {
    account_slug: slug,
  });

  if (error || !data) {
    return names;
  }

  for (const row of data as Array<{
    user_id?: string | null;
    name?: string | null;
  }>) {
    const userId = row.user_id?.trim();
    const name = row.name?.trim();
    if (userId && name && assigneeIds.has(userId)) {
      names.set(userId, name);
    }
  }

  return names;
}

async function loadNativeMeetingTasks(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  transcriptId: string,
  clientId: string | null,
  clientName: string | null,
): Promise<NativeMeetingTask[]> {
  const { data, error } = await client
    .from('meeting_action_items')
    .select(
      'id, suggested_title, suggested_description, suggested_due_date, suggested_assignee_id, status, planner_task_id',
    )
    .eq('meeting_transcript_id', transcriptId)
    .eq('account_id', workspace.id)
    .in('status', ['approved', 'auto_published'])
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const actionItemRows = (data ?? []) as Array<Record<string, unknown>>;
  const plannerTaskIds = actionItemRows
    .map((row) => row.planner_task_id as string | null)
    .filter((id): id is string => Boolean(id));

  const plannerById = new Map<
    string,
    {
      title: string | null;
      dueDate: string | null;
      userId: string | null;
      status: string | null;
    }
  >();

  if (plannerTaskIds.length > 0) {
    const { data: plannerRows, error: plannerError } = await client
      .from('tasks')
      .select('id, title, due_date, user_id, status')
      .eq('account_id', workspace.id)
      .in('id', plannerTaskIds);

    if (plannerError) {
      throw new Error(plannerError.message);
    }

    for (const row of (plannerRows ?? []) as Array<Record<string, unknown>>) {
      plannerById.set(row.id as string, {
        title: (row.title as string | null) ?? null,
        dueDate: (row.due_date as string | null) ?? null,
        userId: (row.user_id as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      });
    }
  }

  const assigneeIds = new Set<string>();
  for (const row of actionItemRows) {
    const plannerTaskId = (row.planner_task_id as string | null) ?? null;
    const planner = plannerTaskId ? plannerById.get(plannerTaskId) : undefined;
    const assigneeUserId =
      planner?.userId ?? (row.suggested_assignee_id as string | null) ?? null;
    if (assigneeUserId) assigneeIds.add(assigneeUserId);
  }

  const assigneeNameById = await loadWorkspaceMemberNames(
    client,
    workspace,
    assigneeIds,
  );

  return actionItemRows.map((row) => {
    const plannerTaskId = (row.planner_task_id as string | null) ?? null;
    const planner = plannerTaskId ? plannerById.get(plannerTaskId) : undefined;
    const assigneeUserId =
      planner?.userId ?? (row.suggested_assignee_id as string | null) ?? null;

    return {
      id: plannerTaskId || (row.id as string),
      title:
        planner?.title?.trim() ||
        ((row.suggested_title as string | null) ?? 'Task').trim() ||
        'Task',
      due:
        planner?.dueDate ?? (row.suggested_due_date as string | null) ?? null,
      status: planner?.status ?? (row.status as string) ?? 'approved',
      assignee_name: assigneeUserId
        ? (assigneeNameById.get(assigneeUserId) ?? null)
        : null,
      planner_task_id: plannerTaskId,
      client_id: clientId,
      client_name: clientName,
    };
  });
}

export async function getNativeMeeting(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  meetingId: string,
): Promise<NativeMeetingDetail> {
  const id = meetingId.trim();
  if (!isUuid(id)) {
    throw new NativeHttpError(404, 'Meeting not found');
  }

  const { data, error } = await client
    .from('meeting_transcripts')
    .select(LIST_SELECT)
    .eq('id', id)
    .eq('account_id', workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(404, 'Meeting not found');
  }

  const row = data as NativeMeetingRow;
  const names = await loadClientRows(
    client,
    [row.client_id ?? ''].filter(Boolean),
  );
  const clientName = nativeMeetingClientName(
    row.client_id ? names.get(row.client_id) : null,
  );
  const meeting = toNativeMeeting(row, workspace, clientName);
  const [summary, tasks] = await Promise.all([
    loadMeetingSummary(client, {
      meetingTranscriptId: id,
      accountId: workspace.id,
    }),
    loadNativeMeetingTasks(
      client,
      workspace,
      id,
      meeting.client_id,
      meeting.client_name,
    ),
  ]);

  return {
    ...meeting,
    notes: summary
      ? {
          text: summary.summaryText,
          generated_at: summary.generatedAt,
        }
      : null,
    tasks,
  };
}
