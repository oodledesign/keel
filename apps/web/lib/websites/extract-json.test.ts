import { describe, expect, it } from 'vitest';

import { extractBalancedJsonSlice, extractJson } from './extract-json';

describe('extractJson', () => {
  it('parses fenced JSON arrays', () => {
    const result = extractJson<Array<{ title: string }>>(
      'Here you go:\n```json\n[{"title":"Home"}]\n```\n',
    );
    expect(result).toEqual([{ title: 'Home' }]);
  });

  it('repairs trailing commas and smart quotes', () => {
    const result = extractJson<{ title: string }>(`{ “title”: “Home”, }`);
    expect(result).toEqual({ title: 'Home' });
  });

  it('detects truncated JSON', () => {
    expect(() =>
      extractJson(`[{"title":"Home","sections":[{"title":"Hero"`),
    ).toThrow(/cut off/i);
  });

  it('extracts balanced nested arrays', () => {
    const slice = extractBalancedJsonSlice(
      'prefix [{"a":1},{"b":[2,3]}] trailing } noise',
    );
    expect(slice).toBe('[{"a":1},{"b":[2,3]}]');
  });
});
