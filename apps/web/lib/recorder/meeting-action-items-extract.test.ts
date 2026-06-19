import { describe, expect, it } from 'vitest';

import { stripJsonFences } from '@kit/email-assistant';

import { parseMeetingExtractResponse } from './meeting-action-items-extract';

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
});
