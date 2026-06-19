import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import {
  assertRecorderSyncAllowed,
  RecorderUsageLimitError,
  recordRecorderSync,
} from '~/lib/recorder/access';
import { queueBrainIndexSource } from '~/lib/brain/sync';
import { resolveMeetingCalendarMetadata } from '~/lib/recorder/calendar-metadata';
import { queueMeetingSummaryGeneration } from '~/lib/recorder/meeting-summary';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

const SyncBodySchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  recorded_at: z.string().optional(),
  duration_seconds: z.number().int().optional(),
  meeting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  client_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function assertClientBelongsToAccount(
  clientId: string,
  accountId: string,
) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

async function assertDealBelongsToAccount(dealId: string, accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('pipeline_deals')
    .select('id')
    .eq('id', dealId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const token = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (token instanceof NextResponse) {
    return token;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = SyncBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid request body');
  }

  const input = parsed.data;

  const admin = getSupabaseServerAdminClient();
  const targetAccountId = input.account_id ?? token.account_id;

  try {
    await assertWorkspaceMember(admin, targetAccountId, token.user_id);
  } catch {
    return badRequest('Invalid workspace for this token');
  }

  try {
    await assertRecorderSyncAllowed(
      admin,
      token.user_id,
      input.duration_seconds ?? 0,
    );
  } catch (error) {
    if (error instanceof RecorderUsageLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          usage: {
            tier: error.summary.tier,
            period: error.summary.period,
            duration_seconds: error.summary.durationSeconds,
            limits: {
              max_duration_seconds_per_month:
                error.summary.limits.maxDurationSecondsPerMonth,
            },
            remaining: {
              duration_seconds: error.summary.remainingDurationSeconds,
            },
          },
        },
        { status: 429 },
      );
    }
    throw error;
  }

  if (Buffer.byteLength(input.content, 'utf8') > MAX_CONTENT_BYTES) {
    return badRequest('Content exceeds maximum size');
  }

  if (input.duration_seconds !== undefined && input.duration_seconds < 0) {
    return badRequest('duration_seconds must not be negative');
  }

  let recordedAt: string | null = null;
  if (input.recorded_at !== undefined) {
    const parsedRecordedAt = Date.parse(input.recorded_at);
    if (Number.isNaN(parsedRecordedAt)) {
      return badRequest('Invalid recorded_at');
    }
    recordedAt = new Date(parsedRecordedAt).toISOString();
  }

  const clientId = input.client_id ?? null;
  const dealId = input.deal_id ?? null;

  if (!clientId && !dealId) {
    return badRequest('client_id or deal_id is required');
  }

  if (clientId && !(await assertClientBelongsToAccount(clientId, targetAccountId))) {
    return badRequest('Invalid client_id for this workspace');
  }

  if (dealId && !(await assertDealBelongsToAccount(dealId, targetAccountId))) {
    return badRequest('Invalid deal_id for this workspace');
  }

  const calendarMetadata = await resolveMeetingCalendarMetadata(admin, {
    userId: token.user_id,
    recordedAt: recordedAt ? new Date(recordedAt) : null,
  });

  const { data: row, error } = await admin
    .from('meeting_transcripts')
    .insert({
      account_id: targetAccountId,
      created_by: token.user_id,
      client_id: clientId,
      deal_id: dealId,
      title: input.title?.trim() || 'Meeting transcript',
      content: input.content.trim(),
      source: 'desktop_recorder',
      recorded_at: recordedAt,
      duration_seconds: input.duration_seconds ?? null,
      meeting_date: input.meeting_date ?? null,
      calendar_event_id: calendarMetadata.calendar_event_id,
      calendar_event_start: calendarMetadata.calendar_event_start,
      calendar_event_end: calendarMetadata.calendar_event_end,
      calendar_attendees: calendarMetadata.calendar_attendees,
    })
    .select('id, account_id, created_at')
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: 'Failed to save meeting transcript' },
      { status: 500 },
    );
  }

  queueBrainIndexSource(targetAccountId, 'transcript', row.id);

  queueMeetingSummaryGeneration({
    meetingTranscriptId: row.id,
    accountId: targetAccountId,
    createdByUserId: token.user_id,
    title: input.title?.trim() || 'Meeting transcript',
    content: input.content.trim(),
    meetingDate: input.meeting_date ?? null,
    calendarAttendees: calendarMetadata.calendar_attendees,
  });

  await recordRecorderSync(token.user_id, input.duration_seconds ?? 0);

  const { data: account } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', targetAccountId)
    .maybeSingle();

  const slug = account?.slug as string | undefined;
  const detailPath = slug
    ? workAccountPath(pathsConfig.app.accountMeetingDetail, slug).replace(
        '[transcriptId]',
        row.id,
      )
    : undefined;

  return NextResponse.json({
    id: row.id,
    account_id: row.account_id,
    created_at: row.created_at,
    ...(detailPath ? { detail_path: detailPath } : {}),
  });
}
