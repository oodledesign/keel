import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type TranscriptSegment,
  resolveTranscriptSegments,
} from '~/lib/recorder/transcript-speakers';

export type PublicMeetingTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
};

export type PublicMeetingPayload = {
  id: string;
  title: string;
  meetingDate: string | null;
  content: string;
  speakerSegments: TranscriptSegment[];
  summaryText: string | null;
  attendeeEmails: string[];
  tasks: PublicMeetingTask[];
};

export async function loadPublicMeetingByToken(
  token: string,
): Promise<PublicMeetingPayload | null> {
  const normalized = token.trim();
  if (!normalized || normalized.length < 16) {
    return null;
  }

  const admin = getSupabaseServerAdminClient() as unknown as SupabaseClient;

  const { data: transcript, error } = await admin
    .from('meeting_transcripts')
    .select(
      'id, title, content, meeting_date, speaker_segments, public_share_enabled, public_share_token',
    )
    .eq('public_share_token', normalized)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error || !transcript) {
    return null;
  }

  const transcriptId = transcript.id as string;
  const content = ((transcript.content as string | null) ?? '').trim();

  const [{ data: summary }, { data: actionItems }] = await Promise.all([
    admin
      .from('meeting_summaries')
      .select('summary_text, attendee_emails')
      .eq('meeting_transcript_id', transcriptId)
      .maybeSingle(),
    admin
      .from('meeting_action_items')
      .select(
        'id, suggested_title, suggested_description, suggested_due_date, status, planner_task_id',
      )
      .eq('meeting_transcript_id', transcriptId)
      .in('status', ['approved', 'auto_published'])
      .order('created_at', { ascending: true }),
  ]);

  const tasks: PublicMeetingTask[] = (
    (actionItems ?? []) as Array<Record<string, unknown>>
  ).map((row) => ({
    id: row.id as string,
    title: ((row.suggested_title as string | null) ?? 'Task').trim() || 'Task',
    description: (row.suggested_description as string | null)?.trim() || null,
    dueDate: (row.suggested_due_date as string | null) ?? null,
    status: (row.status as string) ?? 'approved',
  }));

  return {
    id: transcriptId,
    title:
      ((transcript.title as string | null) ?? 'Meeting').trim() || 'Meeting',
    meetingDate: (transcript.meeting_date as string | null) ?? null,
    content,
    speakerSegments: resolveTranscriptSegments({
      content,
      speakerSegments: transcript.speaker_segments,
    }),
    summaryText: (summary?.summary_text as string | null)?.trim() || null,
    attendeeEmails: Array.isArray(summary?.attendee_emails)
      ? (summary.attendee_emails as string[])
      : [],
    tasks,
  };
}
