import { describe, expect, it } from 'vitest';

import { markdownToPlainText } from './markdown';

describe('markdownToPlainText', () => {
  it('strips headings, emphasis, and underline tags', () => {
    expect(markdownToPlainText('## Me\nHello **there** and <u>under</u>')).toBe(
      'Me Hello there and under',
    );
  });
});
