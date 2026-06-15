import { describe, expect, it } from 'vitest';

import { appendSignature } from './signature';
import { parseExtractResponse, stripJsonFences } from './json';

describe('email-assistant json', () => {
  it('strips markdown fences before parsing', () => {
    const raw = stripJsonFences(
      '```json\n{"items":[{"title":"Send quote","detail":"By Friday","suggested_due_date":"2026-06-13"}]}\n```',
    );

    expect(parseExtractResponse(raw)).toEqual([
      {
        title: 'Send quote',
        detail: 'By Friday',
        suggestedDueDate: '2026-06-13',
      },
    ]);
  });

  it('returns an empty list when JSON is invalid', () => {
    expect(parseExtractResponse('not json')).toEqual([]);
  });

  it('drops items with blank titles', () => {
    expect(
      parseExtractResponse(
        '{"items":[{"title":"  ","detail":"ignored","suggested_due_date":null},{"title":"Follow up","detail":null,"suggested_due_date":null}]}',
      ),
    ).toEqual([
      {
        title: 'Follow up',
        detail: null,
        suggestedDueDate: null,
      },
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
