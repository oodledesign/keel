import { describe, expect, it } from 'vitest';

import { parseExtractResponse, stripJsonFences } from './json';
import { appendSignature } from './signature';

describe('email-assistant json', () => {
  it('strips markdown fences before parsing', () => {
    const raw = stripJsonFences(
      '```json\n{"items":[{"title":"Send quote","detail":"By Friday","suggested_due_date":"2026-06-13","source_excerpt":"Please send the quote by Friday","assignee_confidence":0.9,"suggested_assignee_email":"dan@example.com"}]}\n```',
    );

    expect(parseExtractResponse(raw)).toEqual([
      {
        title: 'Send quote',
        detail: 'By Friday',
        suggestedDueDate: '2026-06-13',
        suggestedDurationMinutes: null,
        sourceExcerpt: 'Please send the quote by Friday',
        assigneeConfidence: 0.9,
        suggestedAssigneeEmail: 'dan@example.com',
      },
    ]);
  });

  it('returns an empty list when JSON is invalid', () => {
    expect(parseExtractResponse('not json')).toEqual([]);
  });

  it('drops items with blank titles', () => {
    expect(
      parseExtractResponse(
        '{"items":[{"title":"  ","detail":"ignored","suggested_due_date":null},{"title":"Follow up","detail":null,"suggested_due_date":null,"source_excerpt":"I will follow up tomorrow","assignee_confidence":0.8,"suggested_assignee_email":null}]}',
      ),
    ).toEqual([
      {
        title: 'Follow up',
        detail: null,
        suggestedDueDate: null,
        suggestedDurationMinutes: null,
        sourceExcerpt: 'I will follow up tomorrow',
        assigneeConfidence: 0.8,
        suggestedAssigneeEmail: null,
      },
    ]);
  });

  it('truncates long source excerpts', () => {
    const excerpt = 'x'.repeat(250);
    const parsed = parseExtractResponse(
      `{"items":[{"title":"Task","detail":null,"suggested_due_date":null,"source_excerpt":"${excerpt}","assignee_confidence":0.5,"suggested_assignee_email":null}]}`,
    );

    expect(parsed[0]?.sourceExcerpt?.length).toBeLessThanOrEqual(200);
  });

  it('parses mentioned durations and leaves others null', () => {
    const parsed = parseExtractResponse(
      '{"items":[{"title":"Prep deck","suggested_duration_minutes":30},{"title":"Workshop","suggested_duration_minutes":"2 hours"},{"title":"Call","suggested_duration_minutes":null}]}',
    );

    expect(parsed.map((item) => item.suggestedDurationMinutes)).toEqual([
      30,
      120,
      null,
    ]);
  });
});

describe('email-assistant draft', () => {
  it('appends the signature when missing', () => {
    expect(appendSignature('Thanks,\nDan', 'Dan Potter\nKeel')).toBe(
      'Thanks,\nDan\n\nDan Potter\nKeel',
    );
  });

  it('does not duplicate an existing signature', () => {
    const signature = 'Dan Potter\nKeel';
    const body = `Thanks,\nDan\n\n${signature}`;

    expect(appendSignature(body, signature)).toBe(body);
  });
});
