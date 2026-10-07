import { describe, expect, it } from 'vitest';

import { fieldDataHash } from './field-hash';
import {
  type SyncableReview,
  buildReviewFieldData,
  missingRequiredFields,
  reviewItemSlug,
  sanitizeFieldMapping,
  shouldSyncReview,
  suggestFieldMapping,
} from './mapping';

const fields = [
  { slug: 'name', displayName: 'Name', type: 'PlainText', isRequired: true },
  { slug: 'slug', displayName: 'Slug', type: 'PlainText', isRequired: true },
  {
    slug: 'stars',
    displayName: 'Star rating',
    type: 'Number',
    isRequired: false,
  },
  {
    slug: 'review-text',
    displayName: 'Review',
    type: 'RichText',
    isRequired: false,
  },
  {
    slug: 'reviewer',
    displayName: 'Reviewer name',
    type: 'PlainText',
    isRequired: true,
  },
  { slug: 'posted', displayName: 'Date', type: 'DateTime', isRequired: false },
  { slug: 'avatar', displayName: 'Avatar', type: 'Image', isRequired: false },
];

const review: SyncableReview = {
  id: '12345678-aaaa-bbbb-cccc-1234567890ab',
  reviewer_name: 'Jo <b>Smith',
  reviewer_photo_url: 'https://x.test/a.png',
  rating: 5,
  comment: 'Great\n\nservice & people',
  reply: null,
  reviewed_at: '2026-01-02T10:00:00Z',
  hidden: false,
};

describe('webflow review mapping', () => {
  it('suggests mapping from field names and types', () => {
    expect(suggestFieldMapping(fields)).toEqual({
      reviewer_name: 'reviewer',
      rating: 'stars',
      comment: 'review-text',
      reviewed_at: 'posted',
      reviewer_photo_url: 'avatar',
    });
  });

  it('builds typed, escaped field data', () => {
    const data = buildReviewFieldData(
      review,
      suggestFieldMapping(fields),
      fields,
    );
    expect(data.stars).toBe(5);
    expect(data['review-text']).toBe('<p>Great</p><p>service &amp; people</p>');
    expect(data.posted).toBe('2026-01-02T10:00:00.000Z');
    expect(data.avatar).toEqual({ url: 'https://x.test/a.png' });
    expect(data.slug).toBe(reviewItemSlug(review));
    expect(String(data.slug)).toMatch(/^jo-b-smith-12345678$/);
  });

  it('hashes deterministically and detects changes', () => {
    const a = buildReviewFieldData(review, { rating: 'stars' }, fields);
    const b = buildReviewFieldData(
      { ...review, rating: 4 },
      { rating: 'stars' },
      fields,
    );
    expect(fieldDataHash(a)).toBe(fieldDataHash({ ...a }));
    expect(fieldDataHash(a)).not.toBe(fieldDataHash(b));
  });

  it('drops invalid mappings and reports unmapped required fields', () => {
    const clean = sanitizeFieldMapping(
      { rating: 'avatar', comment: 'gone', reviewer_name: 'reviewer' },
      fields,
    );
    expect(clean).toEqual({ reviewer_name: 'reviewer' });
    expect(missingRequiredFields({}, fields).map((f) => f.slug)).toEqual([
      'reviewer',
    ]);
  });

  it('filters reviews by settings', () => {
    const base = {
      syncMode: 'all',
      minRating: 4,
      minCharacterCount: 0,
    } as const;
    expect(shouldSyncReview(review, base)).toBe(true);
    expect(shouldSyncReview({ ...review, hidden: true }, base)).toBe(false);
    expect(shouldSyncReview({ ...review, rating: 3 }, base)).toBe(false);
    expect(
      shouldSyncReview(
        { ...review, comment: null },
        { ...base, syncMode: 'with_text' },
      ),
    ).toBe(false);
    expect(shouldSyncReview(review, { ...base, minCharacterCount: 500 })).toBe(
      false,
    );
  });
});
