import 'server-only';

import { after } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  MEETING_POST_SYNC_HEAL_WINDOW_MS,
  MEETING_POST_SYNC_KICK_DEBOUNCE_MS,
  MEETING_POST_SYNC_REPRO_IDS,
  MEETING_POST_SYNC_STALE_MS,
  type MeetingPostSyncStatus,
  nextQueuedMeetingPostSyncStatuses,
  parseMeetingPostSyncStatus,
  shouldScheduleMeetingPostSync,
} from '~/lib/recorder/meeting-post-sync-status';
import { generateAndPersistMeetingSummary } from '~/lib/recorder/meeting-summary';

type PostSyncRow = {
  id: string;
  account_id: string;
  created_by: string | null;
  title: string | null;
  content: string | null;
  meeting_date: string | null;
  calendar_attendees: unknown;
  source: string | null;
  proposal_id: string | null;
  summary_status: string | null;
  task_extraction_status: string | null;
  post_sync_updated_at: string | null;
};

function siteBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  );
}

export function getMeetingPostSyncRunUrl(
  meetingTranscriptId: string,
): string | null {
  const base = siteBaseUrl();
  if (!base) return null;
  return `${base}/api/recorder/meetings/${meetingTranscriptId}/process`;
}

/** Starts the worker request immediately. Resolves true when that worker accepts the job. */
export function kickMeetingPostSyncWorker(
  meetingTranscriptId: string,
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  const url = getMeetingPostSyncRunUrl(meetingTranscriptId);
  if (!secret || !url) return Promise.resolve(false);

  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  })
    .then((response) => response.ok)
    .catch((error) => {
      console.error(
        '[recorder] meeting post-sync worker request failed',
        meetingTranscriptId,
        error,
      );
      return false;
    });
}

/**
 * Start summary + suggested-task extraction on a detached worker.
 * The fetch begins before the response finishes. `after()` keeps this isolate
 * alive until the worker accepts the job, and runs the pipeline here if the
 * worker cannot be reached.
 */
export function scheduleMeetingPostSync(meetingTranscriptId: string) {
  const kick = kickMeetingPostSyncWorker(meetingTranscriptId);

  const run = async () => {
    const kicked = await kick;
    if (kicked) return;

    try {
      await processMeetingPostSync(meetingTranscriptId);
    } catch (error) {
      console.error('[recorder] meeting post-sync local run failed', {
        meetingTranscriptId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  try {
    after(() => run());
  } catch (error) {
    console.error('[recorder] meeting post-sync after() unavailable', {
      meetingTranscriptId,
      error: error instanceof Error ? error.message : String(error),
    });
    void run();
  }
}

function parseAttendees(value: unknown) {
  if (!Array.isArray(value)) return [];

  const attendees: Array<{ name: string; email: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { name?: unknown; email?: unknown };
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const email = typeof record.email === 'string' ? record.email.trim() : '';
    if (!name && !email) continue;
    attendees.push({ name: name || 'Guest', email });
  }
  return attendees;
}

async function loadPostSyncRow(
  admin: SupabaseClient,
  meetingTranscriptId: string,
): Promise<PostSyncRow | null> {
  const { data, error } = await admin
    .from('meeting_transcripts')
    .select(
      'id, account_id, created_by, title, content, meeting_date, calendar_attendees, source, proposal_id, summary_status, task_extraction_status, post_sync_updated_at',
    )
    .eq('id', meetingTranscriptId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PostSyncRow | null) ?? null;
}

function isFreshProcessing(row: PostSyncRow, now: number) {
  const summary = parseMeetingPostSyncStatus(row.summary_status);
  const tasks = parseMeetingPostSyncStatus(row.task_extraction_status);
  if (summary !== 'processing' && tasks !== 'processing') return false;

  const updatedAt = row.post_sync_updated_at
    ? Date.parse(row.post_sync_updated_at)
    : Number.NaN;
  if (Number.isNaN(updatedAt)) return false;
  const age = now - updatedAt;
  return age >= 0 && age < MEETING_POST_SYNC_STALE_MS;
}

async function claimMeetingPostSync(admin: SupabaseClient, row: PostSyncRow) {
  const summary = parseMeetingPostSyncStatus(row.summary_status);
  const tasks = parseMeetingPostSyncStatus(row.task_extraction_status);
  const now = new Date().toISOString();

  let query = admin
    .from('meeting_transcripts')
    .update({
      summary_status: summary === 'ready' ? 'ready' : 'processing',
      task_extraction_status: tasks === 'ready' ? 'ready' : 'processing',
      post_sync_error: null,
      post_sync_updated_at: now,
    })
    .eq('id', row.id)
    .eq('summary_status', summary)
    .eq('task_extraction_status', tasks);

  query = row.post_sync_updated_at
    ? query.eq('post_sync_updated_at', row.post_sync_updated_at)
    : query.is('post_sync_updated_at', null);

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    console.error('[recorder] meeting post-sync claim failed', {
      meetingTranscriptId: row.id,
      error: error.message,
    });
    return false;
  }

  return Boolean(data?.id);
}

export async function processMeetingPostSync(
  meetingTranscriptId: string,
): Promise<{ status: string }> {
  const admin = getSupabaseServerAdminClient();
  const row = await loadPostSyncRow(admin, meetingTranscriptId);
  if (!row) return { status: 'missing' };
  if (row.proposal_id) return { status: 'skipped' };

  const summary = parseMeetingPostSyncStatus(row.summary_status);
  const tasks = parseMeetingPostSyncStatus(row.task_extraction_status);
  if (summary === 'failed' || tasks === 'failed') return { status: 'failed' };
  if (summary === 'ready' && tasks === 'ready') return { status: 'ready' };
  if (isFreshProcessing(row, Date.now())) return { status: 'in_progress' };

  const content = row.content?.trim() ?? '';
  if (!content) {
    await admin
      .from('meeting_transcripts')
      .update({
        summary_status: 'failed',
        task_extraction_status: 'failed',
        post_sync_error:
          'This meeting has no transcript to summarise. Re-sync from Assistant or paste the transcript, then try again.',
        post_sync_updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    return { status: 'failed' };
  }

  const claimed = await claimMeetingPostSync(admin, row);
  if (!claimed) return { status: 'busy' };

  try {
    await generateAndPersistMeetingSummary(
      admin,
      {
        meetingTranscriptId: row.id,
        accountId: row.account_id,
        createdByUserId: row.created_by ?? '',
        title: row.title?.trim() || 'Meeting transcript',
        content,
        meetingDate: row.meeting_date,
        calendarAttendees: parseAttendees(row.calendar_attendees),
      },
      { reuseExistingSummary: true },
    );
  } catch (error) {
    console.error('[recorder] meeting post-sync failed', {
      meetingTranscriptId: row.id,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await admin
        .from('meeting_transcripts')
        .update({
          summary_status: 'failed',
          task_extraction_status: 'failed',
          post_sync_error:
            error instanceof Error
              ? error.message.trim().slice(0, 240) ||
                'Meeting processing failed'
              : 'Meeting processing failed',
          post_sync_updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .in('summary_status', ['pending', 'processing']);
    } catch (statusError) {
      console.error('[recorder] meeting post-sync failed-status write failed', {
        meetingTranscriptId: row.id,
        error:
          statusError instanceof Error
            ? statusError.message
            : String(statusError),
      });
    }

    return { status: 'failed' };
  }

  const finished = await loadPostSyncRow(admin, meetingTranscriptId);
  const finishedSummary = parseMeetingPostSyncStatus(finished?.summary_status);
  const finishedTasks = parseMeetingPostSyncStatus(
    finished?.task_extraction_status,
  );

  if (finishedSummary === 'failed' || finishedTasks === 'failed') {
    return { status: 'failed' };
  }
  if (finishedSummary === 'ready' && finishedTasks === 'ready') {
    return { status: 'ready' };
  }

  return { status: 'partial' };
}

export async function ensureMeetingPostSyncQueued(input: {
  id: string;
  source: string;
  proposalId?: string | null;
  content: string;
  createdAt: string;
  summaryStatus: unknown;
  taskExtractionStatus: unknown;
  postSyncUpdatedAt?: string | null;
  hasSummary: boolean;
}): Promise<{
  summaryStatus: MeetingPostSyncStatus;
  taskExtractionStatus: MeetingPostSyncStatus;
  postSyncError: null;
  postSyncUpdatedAt: string;
} | null> {
  if (!shouldScheduleMeetingPostSync(input)) return null;

  const currentSummary = parseMeetingPostSyncStatus(input.summaryStatus);
  const currentTasks = parseMeetingPostSyncStatus(input.taskExtractionStatus);
  const { summaryStatus, taskExtractionStatus } =
    nextQueuedMeetingPostSyncStatuses({
      summaryStatus: currentSummary,
      taskExtractionStatus: currentTasks,
      hasSummary: input.hasSummary,
    });
  const postSyncUpdatedAt = new Date().toISOString();
  const admin = getSupabaseServerAdminClient();
  let claim = admin
    .from('meeting_transcripts')
    .update({
      summary_status: summaryStatus,
      task_extraction_status: taskExtractionStatus,
      post_sync_error: null,
      post_sync_updated_at: postSyncUpdatedAt,
    })
    .eq('id', input.id)
    .eq('summary_status', currentSummary)
    .eq('task_extraction_status', currentTasks);

  claim = input.postSyncUpdatedAt
    ? claim.eq('post_sync_updated_at', input.postSyncUpdatedAt)
    : claim.is('post_sync_updated_at', null);

  const { data, error } = await claim.select('id').maybeSingle();

  if (error) {
    console.error('[recorder] could not queue meeting post-sync', {
      meetingTranscriptId: input.id,
      error: error.message,
    });
    return null;
  }

  if (!data?.id) return null;

  console.info('[recorder] queued meeting post-sync', {
    meetingTranscriptId: input.id,
    summaryStatus,
    taskExtractionStatus,
    hasSummary: input.hasSummary,
  });

  scheduleMeetingPostSync(input.id);

  return {
    summaryStatus,
    taskExtractionStatus,
    postSyncError: null,
    postSyncUpdatedAt,
  };
}

export async function sweepMeetingPostSync(limit = 8) {
  const admin = getSupabaseServerAdminClient();
  const debounceBefore = new Date(
    Date.now() - MEETING_POST_SYNC_KICK_DEBOUNCE_MS,
  ).toISOString();
  const staleBefore = new Date(
    Date.now() - MEETING_POST_SYNC_STALE_MS,
  ).toISOString();
  const healAfter = new Date(
    Date.now() - MEETING_POST_SYNC_HEAL_WINDOW_MS,
  ).toISOString();

  const [{ data, error }, { data: idleRows, error: idleError }] =
    await Promise.all([
      admin
        .from('meeting_transcripts')
        .select(
          'id, summary_status, task_extraction_status, post_sync_updated_at',
        )
        .is('proposal_id', null)
        .or(
          'summary_status.in.(pending,processing),task_extraction_status.in.(pending,processing)',
        )
        .order('post_sync_updated_at', { ascending: true })
        .limit(40),
      admin
        .from('meeting_transcripts')
        .select(
          'id, source, content, created_at, summary_status, task_extraction_status, post_sync_updated_at',
        )
        .is('proposal_id', null)
        .or(
          'and(summary_status.eq.idle,task_extraction_status.eq.idle),and(summary_status.eq.ready,task_extraction_status.eq.idle)',
        )
        .or(
          `created_at.gte.${healAfter},id.in.(${MEETING_POST_SYNC_REPRO_IDS.join(',')})`,
        )
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  if (error) {
    throw new Error(error.message);
  }
  if (idleError) {
    throw new Error(idleError.message);
  }

  const ids: string[] = [];
  let healedIdle = 0;

  for (const row of data ?? []) {
    if (ids.length >= limit) break;
    const summary = parseMeetingPostSyncStatus(row.summary_status);
    const tasks = parseMeetingPostSyncStatus(row.task_extraction_status);
    if (summary === 'failed' || tasks === 'failed') continue;
    if (summary === 'ready' && tasks === 'ready') continue;

    const updatedAt = row.post_sync_updated_at
      ? Date.parse(row.post_sync_updated_at)
      : Number.NaN;
    const stamp = Number.isNaN(updatedAt)
      ? null
      : new Date(updatedAt).toISOString();
    const pending = summary === 'pending' || tasks === 'pending';
    const processing = summary === 'processing' || tasks === 'processing';

    if (pending && (!stamp || stamp <= debounceBefore)) {
      ids.push(row.id);
      continue;
    }
    if (processing && (!stamp || stamp <= staleBefore)) {
      ids.push(row.id);
    }
  }

  const idleCandidates = (idleRows ?? []).filter((row) => {
    if (ids.includes(row.id)) return false;
    return shouldScheduleMeetingPostSync({
      id: row.id,
      source: row.source ?? '',
      content: row.content ?? '',
      createdAt: row.created_at ?? new Date(0).toISOString(),
      summaryStatus: row.summary_status,
      taskExtractionStatus: row.task_extraction_status,
      postSyncUpdatedAt: row.post_sync_updated_at,
      hasSummary: false,
    });
  });

  const idleSummaryIds = new Set<string>();
  if (idleCandidates.length > 0) {
    const { data: summaryRows } = await admin
      .from('meeting_summaries')
      .select('meeting_transcript_id, summary_text')
      .in(
        'meeting_transcript_id',
        idleCandidates.map((row) => row.id),
      );
    for (const row of summaryRows ?? []) {
      const id = (row as { meeting_transcript_id?: string })
        .meeting_transcript_id;
      const text = (row as { summary_text?: string | null }).summary_text;
      if (id && text?.trim()) idleSummaryIds.add(id);
    }
  }

  for (const row of idleCandidates) {
    if (ids.length + healedIdle >= limit) break;
    const queued = await ensureMeetingPostSyncQueued({
      id: row.id,
      source: row.source ?? '',
      content: row.content ?? '',
      createdAt: row.created_at ?? new Date(0).toISOString(),
      summaryStatus: row.summary_status,
      taskExtractionStatus: row.task_extraction_status,
      postSyncUpdatedAt: row.post_sync_updated_at,
      hasSummary: idleSummaryIds.has(row.id),
    });
    if (queued) {
      healedIdle += 1;
    }
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !siteBaseUrl()) {
    for (const id of ids) {
      await processMeetingPostSync(id);
    }
    return {
      considered: ids.length + healedIdle,
      kicked: ids.length + healedIdle,
    };
  }

  const results = await Promise.all(
    ids.map((id) => kickMeetingPostSyncWorker(id)),
  );

  return {
    considered: ids.length + healedIdle,
    kicked: results.filter(Boolean).length + healedIdle,
  };
}
