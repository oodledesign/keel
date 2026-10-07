import { describe, expect, it } from 'vitest';

import { parseCsvRecords, parseReviewsCsv } from './reviews-csv';

describe('reviews csv', () => {
  it('parses quoted multi-line fields', () => {
    expect(parseCsvRecords('a,b\n"x, y","line1\nline2"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
    ]);
  });

  it('parses reviews, reports bad rows, and dedupes', () => {
    const csv =
      'Reviewer,Stars,Review,Date\n' +
      'Jo,5,"Great, really\nloved it",03/02/2026\n' +
      'Jo,5,"Great, really\nloved it",03/02/2026\n' +
      ',4,Hi,\n' +
      'Sam,9,Bad,\n';
    const result = parseReviewsCsv(csv);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]).toMatchObject({
      reviewerName: 'Jo',
      rating: 5,
      comment: 'Great, really\nloved it',
      reviewedAt: '2026-02-03T00:00:00.000Z',
    });
    expect(result.errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it('requires reviewer and rating headers', () => {
    expect(parseReviewsCsv('a,b\n1,2').errors).toHaveLength(1);
  });
});
