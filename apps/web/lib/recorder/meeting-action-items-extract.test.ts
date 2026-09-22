import { describe, expect, it } from 'vitest';

import { stripJsonFences } from '@kit/email-assistant';

import {
  dedupeMeetingExtractedItems,
  isTranscriptTooThinForTaskExtraction,
  parseMeetingExtractResponse,
  retainExternalMeetingAssignees,
} from './meeting-action-items-extract';

describe('meeting action item extraction parsing', () => {
  it('stripJsonFences removes markdown wrappers', () => {
    expect(
      stripJsonFences(
        '```json\n{"items":[{"suggested_title":"Follow up","task_confidence":0.9}]}\n```',
      ),
    ).toBe('{"items":[{"suggested_title":"Follow up","task_confidence":0.9}]}');
  });

  it('parses meeting-specific fields and filters low-confidence tasks', () => {
    const items = parseMeetingExtractResponse(
      JSON.stringify({
        items: [
          {
            suggested_title: 'Send contract',
            suggested_description: 'Sarah will send the contract by Friday',
            suggested_due_date: '2026-06-20',
            suggested_duration_minutes: '30 mins',
            source_excerpt: 'Sarah will send the contract by Friday',
            task_confidence: 0.92,
            assignee_confidence: 0.88,
            suggested_assignee_email: 'sarah@client.com',
          },
          {
            suggested_title: 'Maybe revisit pricing',
            task_confidence: 0.2,
            assignee_confidence: 0.1,
            suggested_assignee_email: null,
          },
        ],
      }),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      suggestedTitle: 'Send contract',
      suggestedDescription: 'Sarah will send the contract by Friday',
      suggestedDueDate: '2026-06-20',
      suggestedDurationMinutes: 30,
      taskConfidence: 0.92,
      assigneeConfidence: 0.88,
      suggestedAssigneeEmail: 'sarah@client.com',
    });
  });

  it('truncates long source excerpts', () => {
    const excerpt = 'x'.repeat(250);
    const items = parseMeetingExtractResponse(
      JSON.stringify({
        items: [
          {
            suggested_title: 'Task',
            source_excerpt: excerpt,
            task_confidence: 0.9,
            assignee_confidence: 0.5,
            suggested_assignee_email: null,
          },
        ],
      }),
    );

    expect(items[0]?.sourceExcerpt?.length).toBeLessThanOrEqual(200);
    expect(items[0]?.sourceExcerpt?.endsWith('…')).toBe(true);
  });

  it('dedupes duplicate titles within a batch', () => {
    const items = parseMeetingExtractResponse(
      JSON.stringify({
        items: [
          {
            suggested_title: 'Send brand assets',
            task_confidence: 0.9,
            assignee_confidence: 0.4,
            suggested_assignee_email: null,
          },
          {
            suggested_title: '  Send   brand assets ',
            task_confidence: 0.85,
            assignee_confidence: 0.4,
            suggested_assignee_email: null,
          },
        ],
      }),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.suggestedTitle).toBe('Send brand assets');
  });

  it('flags thin transcripts that should skip extraction', () => {
    expect(isTranscriptTooThinForTaskExtraction('Hi')).toBe(true);
    expect(
      isTranscriptTooThinForTaskExtraction(
        [
          'Speaker 1: We should ship the homepage revision by Friday after client approval.',
          'Me: I will send the updated comps tonight and chase brand assets tomorrow morning.',
        ].join(' '),
      ),
    ).toBe(false);
  });
});

describe('dedupeMeetingExtractedItems', () => {
  it('keeps the first title', () => {
    expect(
      dedupeMeetingExtractedItems([
        {
          suggestedTitle: 'Follow up',
          suggestedDescription: 'first',
          suggestedDueDate: null,
          suggestedDurationMinutes: null,
          sourceExcerpt: null,
          taskConfidence: 0.9,
          assigneeConfidence: 0.4,
          suggestedAssigneeEmail: null,
        },
        {
          suggestedTitle: 'Follow up',
          suggestedDescription: 'second',
          suggestedDueDate: null,
          suggestedDurationMinutes: null,
          sourceExcerpt: null,
          taskConfidence: 0.9,
          assigneeConfidence: 0.4,
          suggestedAssigneeEmail: null,
        },
      ]),
    ).toEqual([expect.objectContaining({ suggestedDescription: 'first' })]);
  });
});

describe('retainExternalMeetingAssignees', () => {
  const members = [{ userId: 'user-dan', name: 'Dan', email: 'dan@ozer.so' }];

  it('keeps client-owned commitments as unassigned review items', () => {
    const [item] = retainExternalMeetingAssignees(
      [
        {
          suggestedTitle: 'Send brand assets',
          suggestedDescription: 'Alex will send the logo pack',
          suggestedDueDate: null,
          suggestedDurationMinutes: null,
          sourceExcerpt: 'Alex will send the logo pack',
          taskConfidence: 0.9,
          assigneeConfidence: 0.9,
          suggestedAssigneeEmail: 'Alex@Client.COM',
        },
      ],
      members,
      'dan@ozer.so',
    );

    expect(item?.suggestedAssigneeEmail).toBeNull();
    expect(item?.assigneeConfidence).toBeLessThanOrEqual(0.4);
    expect(item?.suggestedDescription).toContain('Alex@Client.COM');
  });

  it('leaves account-member assignees intact', () => {
    const [item] = retainExternalMeetingAssignees(
      [
        {
          suggestedTitle: 'Update proposal',
          suggestedDescription: null,
          suggestedDueDate: null,
          suggestedDurationMinutes: null,
          sourceExcerpt: null,
          taskConfidence: 0.9,
          assigneeConfidence: 0.9,
          suggestedAssigneeEmail: 'dan@ozer.so',
        },
      ],
      members,
      'dan@ozer.so',
    );

    expect(item?.suggestedAssigneeEmail).toBe('dan@ozer.so');
  });
});
