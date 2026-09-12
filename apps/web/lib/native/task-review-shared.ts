import { clampDurationMinutes } from '~/lib/tasks/task-duration';

import { NativeHttpError } from './http';
import { type NativeTaskClientRow, nativeClientName } from './task-map';
import { isUuid } from './workspace-shared';

export type NativeTaskReviewSource = 'meeting' | 'email';

export type NativeTaskReviewItem = {
  id: string;
  source: NativeTaskReviewSource;
  title: string;
  detail: string | null;
  snippet: string | null;
  due: string | null;
  duration_minutes: number | null;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  context_title: string | null;
  context_date: string | null;
  created_at: string;
};

export type NativeTaskReviewCounts = {
  meeting_count: number;
  email_count: number;
  pending_count: number;
};

export type NativeTaskReviewPayload = NativeTaskReviewCounts & {
  items: NativeTaskReviewItem[];
};

export type NativeTaskReviewAcceptInput = {
  title?: string;
  detail?: string | null;
  due?: string | null;
  durationMinutes?: number | null;
  clientId?: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseNativeTaskReviewSource(
  value: string | null | undefined,
): NativeTaskReviewSource | 'all' {
  if (value == null || value.trim() === '') {
    return 'all';
  }

  switch (value.trim().toLowerCase()) {
    case 'all':
      return 'all';
    case 'meeting':
    case 'meetings':
      return 'meeting';
    case 'email':
    case 'emails':
      return 'email';
    default:
      throw new NativeHttpError(400, 'source must be all, meeting, or email');
  }
}

export function parseNativeTaskReviewDue(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) {
    throw new NativeHttpError(400, 'due must be YYYY-MM-DD');
  }
  return trimmed;
}

export function parseNativeTaskReviewId(value: string | null | undefined) {
  const id = value?.trim() ?? '';
  if (!isUuid(id)) {
    throw new NativeHttpError(400, 'id must be a uuid');
  }
  return id;
}

export function emptyNativeTaskReviewCounts(): NativeTaskReviewCounts {
  return {
    meeting_count: 0,
    email_count: 0,
    pending_count: 0,
  };
}

export function mergeNativeTaskReviewCounts(
  meetingCount: number,
  emailCount: number,
): NativeTaskReviewCounts {
  const meeting_count = Math.max(0, meetingCount);
  const email_count = Math.max(0, emailCount);
  return {
    meeting_count,
    email_count,
    pending_count: meeting_count + email_count,
  };
}

export function unwrapJoinedRow(
  value: unknown,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }

  return value as Record<string, unknown>;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function durationOrNull(value: unknown): number | null {
  return typeof value === 'number' ? clampDurationMinutes(value) : null;
}

export function toNativeMeetingReviewItem(
  row: Record<string, unknown>,
): NativeTaskReviewItem {
  const transcript = unwrapJoinedRow(row.meeting_transcripts);
  const clientRow = unwrapJoinedRow(transcript?.clients) as
    | NativeTaskClientRow
    | null;
  const clientId =
    textOrNull(transcript?.client_id) ?? textOrNull(clientRow?.id) ?? null;

  return {
    id: String(row.id),
    source: 'meeting',
    title: textOrNull(row.suggested_title) || 'Task',
    detail: textOrNull(row.suggested_description),
    snippet: textOrNull(row.source_excerpt),
    due: textOrNull(row.suggested_due_date),
    duration_minutes: durationOrNull(row.suggested_duration_minutes),
    client_id: clientId,
    client_name: nativeClientName(clientRow),
    project_id: null,
    project_name: null,
    context_title: textOrNull(transcript?.title) || 'Meeting',
    context_date: textOrNull(transcript?.meeting_date),
    created_at: textOrNull(row.created_at) || new Date(0).toISOString(),
  };
}

export function toNativeEmailReviewItem(
  row: Record<string, unknown>,
): NativeTaskReviewItem {
  const thread = unwrapJoinedRow(row.email_threads);
  const linkedClient = unwrapJoinedRow(row.clients) as NativeTaskClientRow | null;
  const project = unwrapJoinedRow(row.projects);
  const clientId =
    textOrNull(row.client_id) ??
    textOrNull(thread?.client_id) ??
    textOrNull(linkedClient?.id);
  const projectId =
    textOrNull(row.project_id) ?? textOrNull(thread?.project_id);

  return {
    id: String(row.id),
    source: 'email',
    title: textOrNull(row.title) || 'Task',
    detail: textOrNull(row.detail),
    snippet: textOrNull(row.source_excerpt),
    due: textOrNull(row.suggested_due_date),
    duration_minutes: durationOrNull(row.suggested_duration_minutes),
    client_id: clientId,
    client_name: nativeClientName(linkedClient),
    project_id: projectId,
    project_name: textOrNull(project?.name),
    context_title: textOrNull(thread?.subject) || 'Email',
    context_date:
      textOrNull(thread?.last_message_at) ?? textOrNull(row.created_at),
    created_at: textOrNull(row.created_at) || new Date(0).toISOString(),
  };
}

export function sortNativeTaskReviewItems(items: NativeTaskReviewItem[]) {
  return [...items].sort((left, right) => {
    if (left.created_at === right.created_at) {
      return left.id.localeCompare(right.id);
    }
    return left.created_at < right.created_at ? 1 : -1;
  });
}
