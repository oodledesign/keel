import { normalizeRecipientEmail } from '~/lib/recorder/meeting-notes-recipient-label';

export type MeetingNotesSentEmail = {
  email: string;
  sentAt: string | null;
};

export type MeetingNotesEmailLogRow = {
  recipient_email?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function selectMeetingNotesSentEmails(
  rows: MeetingNotesEmailLogRow[],
  input: {
    transcriptId: string;
    publicShareToken?: string | null;
  },
): MeetingNotesSentEmail[] {
  const token = input.publicShareToken?.trim() || null;
  const byEmail = new Map<string, MeetingNotesSentEmail>();

  for (const row of rows) {
    const email = row.recipient_email
      ? normalizeRecipientEmail(row.recipient_email)
      : '';
    if (!email.includes('@')) continue;

    const metadata = row.metadata ?? {};
    const transcriptId = metadataString(metadata, 'meeting_transcript_id');
    const shareToken = metadataString(metadata, 'public_share_token');
    const matchesTranscript = transcriptId === input.transcriptId;
    const matchesToken = Boolean(token && shareToken === token);

    if (!matchesTranscript && !matchesToken) continue;

    const existing = byEmail.get(email);
    if (existing) continue;

    byEmail.set(email, {
      email,
      sentAt: row.created_at ?? null,
    });
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}
