import { describe, expect, it } from 'vitest';

import {
  MEETING_POST_SYNC_HEAL_WINDOW_MS,
  MEETING_POST_SYNC_KICK_DEBOUNCE_MS,
  MEETING_POST_SYNC_STALE_MS,
  describeMeetingPostSync,
  shouldScheduleMeetingPostSync,
} from './meeting-post-sync-status';

const now = Date.parse('2026-09-22T10:00:00.000Z');

function candidate(
  overrides: Partial<Parameters<typeof shouldScheduleMeetingPostSync>[0]> = {},
) {
  return {
    source: 'desktop_recorder',
    proposalId: null,
    content: 'Alex: Let us ship the homepage.',
    createdAt: new Date(now - 60_000).toISOString(),
    summaryStatus: 'idle',
    taskExtractionStatus: 'idle',
    postSyncUpdatedAt: null,
    hasSummary: false,
    ...overrides,
  };
}

describe('describeMeetingPostSync', () => {
  it('describes an in-flight Assistant sync', () => {
    expect(
      describeMeetingPostSync({
        summaryStatus: 'pending',
        taskExtractionStatus: 'processing',
      }),
    ).toEqual({
      tone: 'progress',
      message: 'Generating summary and suggested tasks…',
      detail: null,
    });
  });

  it('describes task extraction after the summary is ready', () => {
    expect(
      describeMeetingPostSync({
        summaryStatus: 'ready',
        taskExtractionStatus: 'pending',
      })?.message,
    ).toBe('Extracting suggested tasks…');
  });

  it('hides the notice once both stages are finished', () => {
    expect(
      describeMeetingPostSync({
        summaryStatus: 'ready',
        taskExtractionStatus: 'ready',
      }),
    ).toBeNull();
    expect(
      describeMeetingPostSync({
        summaryStatus: 'idle',
        taskExtractionStatus: 'idle',
      }),
    ).toBeNull();
  });

  it('keeps a recoverable error for the workspace and a generic line publicly', () => {
    expect(
      describeMeetingPostSync({
        summaryStatus: 'ready',
        taskExtractionStatus: 'failed',
        error: 'Model timeout',
      }),
    ).toEqual({
      tone: 'error',
      message: 'Suggested tasks could not be extracted.',
      detail: 'Model timeout',
    });

    expect(
      describeMeetingPostSync({
        summaryStatus: 'failed',
        taskExtractionStatus: 'failed',
        error: 'Model timeout',
        audience: 'public',
      }),
    ).toEqual({
      tone: 'error',
      message: 'Summary and suggested tasks are not ready yet.',
      detail: null,
    });
  });
});

describe('shouldScheduleMeetingPostSync', () => {
  it('queues a recent Assistant transcript that never started', () => {
    expect(shouldScheduleMeetingPostSync(candidate(), now)).toBe(true);
  });

  it('does not queue paste meetings, survey captures, or empty transcripts', () => {
    expect(
      shouldScheduleMeetingPostSync(candidate({ source: 'paste' }), now),
    ).toBe(false);
    expect(
      shouldScheduleMeetingPostSync(candidate({ proposalId: 'survey-1' }), now),
    ).toBe(false);
    expect(
      shouldScheduleMeetingPostSync(candidate({ content: '   ' }), now),
    ).toBe(false);
  });

  it('does not re-kick a job that was just queued or is still processing', () => {
    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          summaryStatus: 'pending',
          taskExtractionStatus: 'pending',
          postSyncUpdatedAt: new Date(now - 5_000).toISOString(),
        }),
        now,
      ),
    ).toBe(false);

    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          summaryStatus: 'processing',
          taskExtractionStatus: 'processing',
          postSyncUpdatedAt: new Date(now - 60_000).toISOString(),
        }),
        now,
      ),
    ).toBe(false);
  });

  it('re-kicks a pending job whose worker never claimed it and a stale processing job', () => {
    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          summaryStatus: 'pending',
          taskExtractionStatus: 'pending',
          postSyncUpdatedAt: new Date(
            now - MEETING_POST_SYNC_KICK_DEBOUNCE_MS - 1_000,
          ).toISOString(),
        }),
        now,
      ),
    ).toBe(true);

    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          summaryStatus: 'processing',
          taskExtractionStatus: 'processing',
          postSyncUpdatedAt: new Date(
            now - MEETING_POST_SYNC_STALE_MS - 1_000,
          ).toISOString(),
        }),
        now,
      ),
    ).toBe(true);
  });

  it('leaves failed jobs for the meeting page retry and skips finished meetings', () => {
    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          summaryStatus: 'failed',
          taskExtractionStatus: 'failed',
        }),
        now,
      ),
    ).toBe(false);
    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          summaryStatus: 'ready',
          taskExtractionStatus: 'ready',
          hasSummary: true,
        }),
        now,
      ),
    ).toBe(false);
  });

  it('does not backfill Assistant meetings older than the heal window', () => {
    expect(
      shouldScheduleMeetingPostSync(
        candidate({
          createdAt: new Date(
            now - MEETING_POST_SYNC_HEAL_WINDOW_MS - 1_000,
          ).toISOString(),
        }),
        now,
      ),
    ).toBe(false);
  });
});
