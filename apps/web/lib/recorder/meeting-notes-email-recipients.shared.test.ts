import { describe, expect, it } from 'vitest';

import { selectMeetingNotesSentEmails } from './meeting-notes-email-recipients.shared';

describe('selectMeetingNotesSentEmails', () => {
  it('keeps unique recipients for this meeting via token or transcript id', () => {
    const rows = [
      {
        recipient_email: 'Dan@oodle.design',
        created_at: '2026-09-18T10:00:00.000Z',
        metadata: { public_share_token: 'token-a' },
      },
      {
        recipient_email: 'dan@oodle.design',
        created_at: '2026-09-17T10:00:00.000Z',
        metadata: { meeting_transcript_id: 'mtg-1' },
      },
      {
        recipient_email: 'other@example.com',
        created_at: '2026-09-18T11:00:00.000Z',
        metadata: { public_share_token: 'token-b' },
      },
      {
        recipient_email: 'mick.haselden@angellane.org.uk',
        created_at: '2026-09-18T09:00:00.000Z',
        metadata: { meeting_transcript_id: 'mtg-1' },
      },
    ];

    expect(
      selectMeetingNotesSentEmails(rows, {
        transcriptId: 'mtg-1',
        publicShareToken: 'token-a',
      }),
    ).toEqual([
      { email: 'dan@oodle.design', sentAt: '2026-09-18T10:00:00.000Z' },
      {
        email: 'mick.haselden@angellane.org.uk',
        sentAt: '2026-09-18T09:00:00.000Z',
      },
    ]);
  });
});
