import { describe, expect, it } from 'vitest';

import {
  captionFromObservations,
  proposeCuratedPhotosHeuristic,
  sanitisePhotoCuration,
} from './photo-curate';

const OBSERVATIONS = [
  {
    sectionKey: 'windows',
    body: 'The front sash is stiff and the putty is cracked.',
  },
  {
    sectionKey: 'roof_coverings',
    body: 'A few slipped slates to the rear pitch.',
  },
];

const PHOTOS = [
  { id: 'p1', title: 'Front sash window close-up' },
  { id: 'p2', title: 'Rear roof slates' },
  { id: 'p3', title: 'Kitchen tap' },
  { id: 'p4', title: 'Window cill decay' },
];

describe('proposeCuratedPhotosHeuristic', () => {
  it('picks titled photos for sections that have observations', () => {
    const curated = proposeCuratedPhotosHeuristic({
      photos: PHOTOS,
      observations: OBSERVATIONS,
    });

    expect(curated.some((item) => item.sectionKey === 'windows')).toBe(true);
    expect(curated.some((item) => item.sectionKey === 'roof_coverings')).toBe(
      true,
    );
    expect(curated.every((item) => item.caption.length > 0)).toBe(true);
    expect(new Set(curated.map((item) => item.docId)).size).toBe(
      curated.length,
    );
  });

  it('skips sections with no report text', () => {
    const curated = proposeCuratedPhotosHeuristic({
      photos: PHOTOS,
      observations: [OBSERVATIONS[0]!],
    });

    expect(curated.every((item) => item.sectionKey === 'windows')).toBe(true);
  });
});

describe('sanitisePhotoCuration', () => {
  it('drops unknown ids, empty sections, and reused photos', () => {
    const cleaned = sanitisePhotoCuration(
      [
        {
          docId: 'p1',
          sectionKey: 'windows',
          caption: 'Cracked putty to the lower sash.',
          sortOrder: 0,
        },
        {
          docId: 'p1',
          sectionKey: 'roof_coverings',
          caption: 'Should be ignored',
          sortOrder: 0,
        },
        {
          docId: 'missing',
          sectionKey: 'windows',
          caption: 'No',
          sortOrder: 1,
        },
        {
          docId: 'p3',
          sectionKey: 'heating',
          caption: 'Empty section',
          sortOrder: 0,
        },
      ],
      PHOTOS,
      OBSERVATIONS,
    );

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.docId).toBe('p1');
    expect(cleaned[0]?.sectionKey).toBe('windows');
  });
});

describe('captionFromObservations', () => {
  it('uses the first observation sentence', () => {
    expect(
      captionFromObservations(
        ['The front sash is stiff and the putty is cracked. More later.'],
        'Window',
      ),
    ).toMatch(/front sash is stiff/i);
  });
});
