import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type MeetingNotesEmailLogRow,
  type MeetingNotesSentEmail,
  selectMeetingNotesSentEmails,
} from '~/lib/recorder/meeting-notes-email-recipients.shared';

export type { MeetingNotesSentEmail };

function isSafeMetadataFilterValue(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

export async function loadMeetingNotesSentEmails(
  client: SupabaseClient,
  input: {
    accountId: string;
    transcriptId: string;
    publicShareToken?: string | null;
  },
): Promise<MeetingNotesSentEmail[]> {
  const filters: string[] = [];
  if (isSafeMetadataFilterValue(input.transcriptId)) {
    filters.push(`(metadata->>meeting_transcript_id.eq.${input.transcriptId})`);
  }
  if (
    input.publicShareToken &&
    isSafeMetadataFilterValue(input.publicShareToken)
  ) {
    filters.push(
      `(metadata->>public_share_token.eq.${input.publicShareToken})`,
    );
  }

  const query = (
    client as unknown as {
      from: (table: string) => ReturnType<typeof client.from>;
    }
  )
    .from('platform_email_log')
    .select('recipient_email, created_at, metadata')
    .eq('account_id', input.accountId)
    .eq('email_type', 'meeting_notes')
    .eq('status', 'sent');

  const filteredQuery =
    filters.length > 0 ? query.or(filters.join(',')) : query;

  const { data, error } = await filteredQuery
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.warn('[meeting-notes] load sent emails failed', error.message);
    return [];
  }

  return selectMeetingNotesSentEmails(
    (data ?? []) as MeetingNotesEmailLogRow[],
    {
      transcriptId: input.transcriptId,
      publicShareToken: input.publicShareToken,
    },
  );
}
