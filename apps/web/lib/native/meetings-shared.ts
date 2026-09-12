import { parseTranscriptContent } from '~/lib/recorder/transcript-speakers';

import { NativeHttpError } from './http';
import { type NativeTaskClientRow, nativeClientName } from './task-map';
import type { NativeWorkspace } from './workspace-shared';

export const NATIVE_MEETING_SOURCES = [
  'paste',
  'upload',
  'desktop_recorder',
  'iphone',
] as const;

export type NativeMeetingSource = (typeof NATIVE_MEETING_SOURCES)[number];

/** Persisted CHECK today is paste | upload | desktop_recorder. */
export const NATIVE_MEETING_STORED_SOURCES = [
  'paste',
  'upload',
  'desktop_recorder',
] as const;

export type NativeMeetingStoredSource =
  (typeof NATIVE_MEETING_STORED_SOURCES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IOS_SPEAKER_HEADING_RE =
  /^(?:#{1,6}\s+|\*{2})?(Me|Them|Speaker \d+)(?:\*{2})?$/i;

export type NativeMeeting = {
  id: string;
  title: string;
  content: string;
  workspace: string;
  client_id: string | null;
  client_name: string | null;
  meeting_date: string | null;
  source: NativeMeetingStoredSource;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type NativeMeetingListItem = NativeMeeting & {
  has_extracted_tasks: boolean;
};

export type NativeUpcomingMeeting = {
  id: string;
  title: string;
  start_at: string;
  invitee_name: string;
  conferencing_url: string | null;
};

export type NativeMeetingNotes = {
  text: string;
  generated_at: string | null;
};

export type NativeMeetingTask = {
  id: string;
  title: string;
  due: string | null;
  status: string;
  assignee_name: string | null;
  planner_task_id: string | null;
  client_id: string | null;
  client_name: string | null;
};

export type NativeMeetingDetail = NativeMeeting & {
  notes: NativeMeetingNotes | null;
  tasks: NativeMeetingTask[];
};

export type NativeMeetingRow = {
  id: string;
  title?: string | null;
  content?: string | null;
  client_id?: string | null;
  meeting_date?: string | null;
  source?: string | null;
  duration_seconds?: number | null;
  created_at: string;
  updated_at: string;
};

export function parseNativeMeetingDate(
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === '') return null;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) {
    throw new NativeHttpError(400, 'meeting_date must be YYYY-MM-DD');
  }
  return trimmed;
}

export function parseNativeMeetingSource(
  value: string | null | undefined,
): NativeMeetingStoredSource {
  if (value == null || value.trim() === '') {
    return 'desktop_recorder';
  }

  switch (value.trim()) {
    case 'paste':
    case 'upload':
    case 'desktop_recorder':
      return value.trim() as NativeMeetingStoredSource;
    case 'iphone':
      return 'desktop_recorder';
    default:
      throw new NativeHttpError(
        400,
        'source must be paste, upload, desktop_recorder, or iphone',
      );
  }
}

function iosSpeakerHeading(line: string): string | null {
  const match = line.trim().match(IOS_SPEAKER_HEADING_RE);
  return match?.[1] ?? null;
}

/**
 * iOS live captions use a speaker heading on its own line (`Me`, `## Me`).
 * Web parse expects `Speaker: text`. Convert when labels are only headings.
 */
export function normalizeNativeMeetingContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  const parsed = parseTranscriptContent(trimmed);
  if (parsed.hasSpeakerLabels) {
    return trimmed;
  }

  const segments: { speaker: string; lines: string[] }[] = [];
  let current: { speaker: string; lines: string[] } | null = null;

  for (const raw of trimmed.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = iosSpeakerHeading(line);
    if (heading) {
      current = { speaker: heading, lines: [] };
      segments.push(current);
      continue;
    }
    if (!current) {
      current = { speaker: 'Unknown', lines: [line] };
      segments.push(current);
      continue;
    }
    current.lines.push(line);
  }

  const labelled = segments.filter((segment) =>
    Boolean(iosSpeakerHeading(segment.speaker)),
  );
  if (labelled.length === 0) {
    return trimmed;
  }

  return segments
    .map((segment) => {
      const text = segment.lines.join(' ').trim();
      return text ? `${segment.speaker}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

export function storedMeetingSource(
  value: string | null | undefined,
): NativeMeetingStoredSource {
  if (value === 'upload') return 'upload';
  if (value === 'desktop_recorder' || value === 'iphone') {
    return 'desktop_recorder';
  }
  if (value === 'paste') return 'paste';
  return 'desktop_recorder';
}

export function parseNativeMeetingDuration(
  value: number | null | undefined,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value);
}

export function toNativeMeeting(
  row: NativeMeetingRow,
  workspace: NativeWorkspace,
  clientName?: string | null,
): NativeMeeting {
  const source = storedMeetingSource(row.source);
  return {
    id: row.id,
    title: row.title?.trim() || 'Meeting transcript',
    content: row.content ?? '',
    workspace: workspace.slug,
    client_id: row.client_id?.trim() || null,
    client_name: clientName?.trim() || null,
    meeting_date: row.meeting_date?.trim() || null,
    source,
    duration_seconds: parseNativeMeetingDuration(row.duration_seconds),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function nativeMeetingClientName(
  row: NativeTaskClientRow | null | undefined,
): string | null {
  return nativeClientName(row);
}
