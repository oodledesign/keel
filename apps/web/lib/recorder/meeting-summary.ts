import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueBrainIndexSource } from '~/lib/brain/sync';
import { extractAndPersistMeetingActionItems } from '~/lib/recorder/meeting-action-items';
import type { MeetingPostSyncStatus } from '~/lib/recorder/meeting-post-sync-status';
import {
  attendeeEmailsFromCalendarAttendees,
  generateMeetingSummaryText,
} from '~/lib/recorder/meeting-summary-generate';

export type MeetingSummaryJobInput = {
  meetingTranscriptId: string;
  accountId: string;
  createdByUserId: string;
  title: string;
  content: string;
  meetingDate?: string | null;
  calendarAttendees?: Array<{ name: string; email: string }>;
};

export type MeetingSummaryJobOptions = {
  /** Reuse a saved summary and only run task extraction. Manual regenerate sets this false. */
  reuseExistingSummary?: boolean;
};

function postSyncErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 500) || 'Meeting processing failed';
}

async function writeMeetingPostSyncStatus(
  admin: SupabaseClient,
  meetingTranscriptId: string,
  patch: {
    summaryStatus?: MeetingPostSyncStatus;
    taskExtractionStatus?: MeetingPostSyncStatus;
    error?: string | null;
  },
) {
  const update: {
    post_sync_updated_at: string;
    summary_status?: MeetingPostSyncStatus;
    task_extraction_status?: MeetingPostSyncStatus;
    post_sync_error?: string | null;
  } = {
    post_sync_updated_at: new Date().toISOString(),
  };

  if (patch.summaryStatus) {
    update.summary_status = patch.summaryStatus;
  }
  if (patch.taskExtractionStatus) {
    update.task_extraction_status = patch.taskExtractionStatus;
  }
  if ('error' in patch) {
    update.post_sync_error = patch.error;
  }

  const { error } = await admin
    .from('meeting_transcripts')
    .update(update)
    .eq('id', meetingTranscriptId);

  if (error) {
    console.error('[recorder] meeting post-sync status update failed', {
      meetingTranscriptId,
      error: error.message,
    });
  }
}

export async function generateAndPersistMeetingSummary(
  admin: SupabaseClient,
  input: MeetingSummaryJobInput,
  options?: MeetingSummaryJobOptions,
): Promise<void> {
  const attendeeEmails = attendeeEmailsFromCalendarAttendees(
    input.calendarAttendees ?? [],
  );

  let summaryText: string | null = null;

  if (options?.reuseExistingSummary) {
    const existing = await loadMeetingSummary(admin, {
      meetingTranscriptId: input.meetingTranscriptId,
      accountId: input.accountId,
    });
    summaryText = existing?.summaryText ?? null;
  }

  if (!summaryText) {
    await writeMeetingPostSyncStatus(admin, input.meetingTranscriptId, {
      summaryStatus: 'processing',
      taskExtractionStatus: 'processing',
      error: null,
    });

    try {
      summaryText = await generateMeetingSummaryText(
        {
          title: input.title,
          transcript: input.content,
          meetingDate: input.meetingDate,
          attendees: input.calendarAttendees,
        },
        { accountId: input.accountId, supabase: admin },
      );

      const { error } = await admin.from('meeting_summaries').upsert(
        {
          meeting_transcript_id: input.meetingTranscriptId,
          account_id: input.accountId,
          summary_text: summaryText,
          attendee_emails: attendeeEmails,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'meeting_transcript_id' },
      );

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      const message = postSyncErrorMessage(error);
      await writeMeetingPostSyncStatus(admin, input.meetingTranscriptId, {
        summaryStatus: 'failed',
        taskExtractionStatus: 'failed',
        error: message,
      });
      throw error;
    }
  }

  await writeMeetingPostSyncStatus(admin, input.meetingTranscriptId, {
    summaryStatus: 'ready',
    taskExtractionStatus: 'processing',
    error: null,
  });

  try {
    await extractAndPersistMeetingActionItems(admin, {
      meetingTranscriptId: input.meetingTranscriptId,
      accountId: input.accountId,
      createdByUserId: input.createdByUserId,
      title: input.title,
      content: input.content,
      summaryText,
      meetingDate: input.meetingDate,
      calendarAttendees: input.calendarAttendees,
    });
  } catch (error) {
    const message = postSyncErrorMessage(error);
    console.error('[recorder] meeting action item extraction failed', {
      meetingTranscriptId: input.meetingTranscriptId,
      accountId: input.accountId,
      error: message,
    });
    await writeMeetingPostSyncStatus(admin, input.meetingTranscriptId, {
      taskExtractionStatus: 'failed',
      error: message,
    });
    queueBrainIndexSource(
      input.accountId,
      'transcript',
      input.meetingTranscriptId,
    );
    return;
  }

  await writeMeetingPostSyncStatus(admin, input.meetingTranscriptId, {
    summaryStatus: 'ready',
    taskExtractionStatus: 'ready',
    error: null,
  });

  queueBrainIndexSource(
    input.accountId,
    'transcript',
    input.meetingTranscriptId,
  );
}

export type MeetingSummaryRecord = {
  summaryText: string;
  attendeeEmails: string[];
  generatedAt: string;
};

export async function loadMeetingSummary(
  client: SupabaseClient,
  input: { meetingTranscriptId: string; accountId: string },
): Promise<MeetingSummaryRecord | null> {
  const { data, error } = await client
    .from('meeting_summaries')
    .select('summary_text, attendee_emails, generated_at')
    .eq('meeting_transcript_id', input.meetingTranscriptId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    summary_text?: string | null;
    attendee_emails?: string[] | null;
    generated_at?: string | null;
  };

  const summaryText = row.summary_text?.trim();
  if (!summaryText) {
    return null;
  }

  return {
    summaryText,
    attendeeEmails: row.attendee_emails ?? [],
    generatedAt: row.generated_at ?? new Date().toISOString(),
  };
}
