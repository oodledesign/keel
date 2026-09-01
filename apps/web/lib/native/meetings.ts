import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueBrainIndexSource } from '~/lib/brain/sync';
import { parseTranscriptContent } from '~/lib/recorder/transcript-speakers';

import { NativeHttpError } from './http';
import {
  type NativeMeeting,
  type NativeMeetingRow,
  nativeMeetingClientName,
  normalizeNativeMeetingContent,
  parseNativeMeetingDate,
  parseNativeMeetingSource,
  toNativeMeeting,
} from './meetings-shared';
import type { NativeTaskClientRow } from './task-map';
import { parseOptionalClientId } from './task-map';
import type { NativeWorkspace } from './workspace-shared';

export type { NativeMeeting } from './meetings-shared';
export {
  normalizeNativeMeetingContent,
  parseNativeMeetingDate,
  parseNativeMeetingSource,
  toNativeMeeting,
} from './meetings-shared';

const LIST_LIMIT = 100;

const LIST_SELECT =
  'id, title, content, client_id, meeting_date, source, created_at, updated_at';

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

function insertFailed(message: string): never {
  if (/row-level security|permission denied|policy/i.test(message)) {
    throw new NativeHttpError(
      403,
      'You cannot save meetings in this workspace',
    );
  }
  if (/client_or_deal|a client or deal/i.test(message)) {
    throw new NativeHttpError(400, 'A client is required');
  }
  if (/source/i.test(message) && /check/i.test(message)) {
    throw new NativeHttpError(400, 'Invalid meeting source');
  }
  throw new Error(message);
}

export async function listNativeMeetings(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeMeeting[]> {
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
  const names = await loadClientRows(
    client,
    rows.map((row) => row.client_id ?? '').filter(Boolean),
  );

  return rows.map((row) =>
    toNativeMeeting(
      row,
      workspace,
      nativeMeetingClientName(row.client_id ? names.get(row.client_id) : null),
    ),
  );
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
    insertFailed(error?.message ?? 'Failed to create meeting transcript');
  }

  const row = data as NativeMeetingRow;
  queueBrainIndexSource(input.workspace.id, 'transcript', row.id);

  return toNativeMeeting(
    row,
    input.workspace,
    nativeMeetingClientName(clientRow),
  );
}
