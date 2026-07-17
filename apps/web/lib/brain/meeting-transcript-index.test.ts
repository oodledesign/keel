import { describe, expect, it } from 'vitest';

import {
  buildMeetingTranscriptIndexText,
  meetingTranscriptIndexUpdatedAt,
} from './meeting-transcript-index';

describe('buildMeetingTranscriptIndexText', () => {
  it('includes summary, action items, and transcript sections', () => {
    const text = buildMeetingTranscriptIndexText({
      title: 'Kickoff call',
      content: 'Speaker 1: Hello',
      meetingDate: '2026-06-12',
      clientName: 'Acme Co',
      attendeeEmails: ['alex@acme.test'],
      summaryText: 'Discussed scope and timeline.',
      actionItems: [
        {
          suggested_title: 'Send proposal',
          suggested_description: 'Draft by Friday',
          source_excerpt: 'we need a proposal',
        },
      ],
    });

    expect(text).toContain('# Kickoff call');
    expect(text).toContain('Client: Acme Co');
    expect(text).toContain('## Meeting summary');
    expect(text).toContain('Discussed scope and timeline.');
    expect(text).toContain('## Action items');
    expect(text).toContain('- Send proposal');
    expect(text).toContain('## Transcript');
    expect(text).toContain('Speaker 1: Hello');
  });

  it('indexes summary and action items when transcript body is empty', () => {
    const text = buildMeetingTranscriptIndexText({
      title: 'Strategy sync',
      content:
        '(Transcript text not stored — see summary and action items below.)',
      summaryText: 'Agreed to launch in March.',
      actionItems: [{ suggested_title: 'Confirm launch date' }],
    });

    expect(text).toContain('## Meeting summary');
    expect(text).toContain('Agreed to launch in March.');
    expect(text).toContain('Confirm launch date');
  });
});

describe('meetingTranscriptIndexUpdatedAt', () => {
  it('uses the latest timestamp from transcript, summary, and action items', () => {
    const updatedAt = meetingTranscriptIndexUpdatedAt(
      '2026-06-01T10:00:00.000Z',
      {
        summaryText: 'Summary',
        attendeeEmails: [],
        summaryGeneratedAt: '2026-06-02T10:00:00.000Z',
        actionItems: [],
        latestActionItemAt: '2026-06-03T10:00:00.000Z',
      },
    );

    expect(updatedAt).toBe('2026-06-03T10:00:00.000Z');
  });
});
