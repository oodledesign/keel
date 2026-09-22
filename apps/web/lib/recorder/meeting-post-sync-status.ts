export const MEETING_POST_SYNC_STATUSES = [
  'idle',
  'pending',
  'processing',
  'ready',
  'failed',
] as const;

export type MeetingPostSyncStatus = (typeof MEETING_POST_SYNC_STATUSES)[number];

/** Re-kick a pending job if the original worker never claimed it. */
export const MEETING_POST_SYNC_KICK_DEBOUNCE_MS = 20_000;

/** Reclaim a processing job whose worker died mid-run. */
export const MEETING_POST_SYNC_STALE_MS = 10 * 60 * 1000;

/** Heal Assistant syncs that landed before status tracking existed. */
export const MEETING_POST_SYNC_HEAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type MeetingPostSyncNotice = {
  tone: 'progress' | 'error';
  message: string;
  detail: string | null;
};

export function parseMeetingPostSyncStatus(
  value: unknown,
): MeetingPostSyncStatus {
  if (
    typeof value === 'string' &&
    (MEETING_POST_SYNC_STATUSES as readonly string[]).includes(value)
  ) {
    return value as MeetingPostSyncStatus;
  }

  return 'idle';
}

export function describeMeetingPostSync(input: {
  summaryStatus: unknown;
  taskExtractionStatus: unknown;
  error?: string | null;
  audience?: 'workspace' | 'public';
}): MeetingPostSyncNotice | null {
  const summary = parseMeetingPostSyncStatus(input.summaryStatus);
  const tasks = parseMeetingPostSyncStatus(input.taskExtractionStatus);
  const detail = input.error?.trim() || null;
  const summaryBusy = summary === 'pending' || summary === 'processing';
  const tasksBusy = tasks === 'pending' || tasks === 'processing';

  let notice: MeetingPostSyncNotice | null = null;

  if (summary === 'failed' || tasks === 'failed') {
    const message =
      summary === 'failed' && tasks === 'failed'
        ? 'Summary and suggested tasks could not be generated.'
        : summary === 'failed'
          ? 'Summary generation failed.'
          : 'Suggested tasks could not be extracted.';
    notice = { tone: 'error', message, detail };
  } else if (summaryBusy && tasksBusy) {
    notice = {
      tone: 'progress',
      message: 'Generating summary and suggested tasks…',
      detail: null,
    };
  } else if (summaryBusy) {
    notice = {
      tone: 'progress',
      message: 'Generating summary…',
      detail: null,
    };
  } else if (tasksBusy) {
    notice = {
      tone: 'progress',
      message: 'Extracting suggested tasks…',
      detail: null,
    };
  }

  if (!notice || input.audience !== 'public') {
    return notice;
  }

  if (notice.tone === 'error') {
    return {
      tone: 'error',
      message: 'Summary and suggested tasks are not ready yet.',
      detail: null,
    };
  }

  return { tone: 'progress', message: notice.message, detail: null };
}

export function shouldScheduleMeetingPostSync(
  input: {
    source: string;
    proposalId?: string | null;
    content: string;
    createdAt: string;
    summaryStatus: unknown;
    taskExtractionStatus: unknown;
    postSyncUpdatedAt?: string | null;
    hasSummary: boolean;
  },
  now = Date.now(),
): boolean {
  if (input.proposalId) return false;
  if (input.source !== 'desktop_recorder') return false;
  if (!input.content.trim()) return false;

  const summary = parseMeetingPostSyncStatus(input.summaryStatus);
  const tasks = parseMeetingPostSyncStatus(input.taskExtractionStatus);

  if (summary === 'failed' || tasks === 'failed') return false;
  if (summary === 'ready' && (tasks === 'ready' || tasks === 'idle')) {
    return false;
  }

  const updatedAt = input.postSyncUpdatedAt
    ? Date.parse(input.postSyncUpdatedAt)
    : Number.NaN;
  const age = Number.isNaN(updatedAt)
    ? Number.POSITIVE_INFINITY
    : now - updatedAt;

  const processing = summary === 'processing' || tasks === 'processing';
  if (processing && age >= 0 && age < MEETING_POST_SYNC_STALE_MS) {
    return false;
  }

  const pending = summary === 'pending' || tasks === 'pending';
  if (pending && age >= 0 && age < MEETING_POST_SYNC_KICK_DEBOUNCE_MS) {
    return false;
  }

  if (summary === 'idle' && tasks === 'idle') {
    if (input.hasSummary) return false;
    const createdAt = Date.parse(input.createdAt);
    if (
      Number.isNaN(createdAt) ||
      now - createdAt > MEETING_POST_SYNC_HEAL_WINDOW_MS
    ) {
      return false;
    }
    return true;
  }

  return pending || processing;
}
