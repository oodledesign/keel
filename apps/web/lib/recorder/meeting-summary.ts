import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { queueBrainIndexSource } from '~/lib/brain/sync';
import { extractAndPersistMeetingActionItems } from '~/lib/recorder/meeting-action-items';
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

export async function generateAndPersistMeetingSummary(
  admin: SupabaseClient,
  input: MeetingSummaryJobInput,
): Promise<void> {
  const attendeeEmails = attendeeEmailsFromCalendarAttendees(
    input.calendarAttendees ?? [],
  );

  const summaryText = await generateMeetingSummaryText({
    title: input.title,
    transcript: input.content,
    meetingDate: input.meetingDate,
    attendees: input.calendarAttendees,
  });

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
    console.error('[recorder] meeting action item extraction failed', {
      meetingTranscriptId: input.meetingTranscriptId,
      accountId: input.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  queueBrainIndexSource(
    input.accountId,
    'transcript',
    input.meetingTranscriptId,
  );
}

export function queueMeetingSummaryGeneration(input: MeetingSummaryJobInput) {
  const admin = getSupabaseServerAdminClient();

  void generateAndPersistMeetingSummary(admin, input).catch((error) => {
    console.error('[recorder] meeting summary generation failed', {
      meetingTranscriptId: input.meetingTranscriptId,
      accountId: input.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
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
