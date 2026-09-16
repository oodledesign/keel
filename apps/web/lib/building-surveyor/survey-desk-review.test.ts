import { describe, expect, it } from 'vitest';

import {
  adjacentDeskReviewSection,
  deskReviewSections,
  firstDeskReviewSectionKey,
} from './survey-desk-review';

describe('deskReviewSections', () => {
  it('lists coded sections with previous/next neighbours', () => {
    const sections = deskReviewSections(2, {
      noteKeys: ['water', 'F3'],
      photoCountByKey: new Map([['roof_coverings', 3]]),
    });
    const water = sections.find((item) => item.key === 'water');
    const roof = sections.find((item) => item.key === 'roof_coverings');

    expect(water).toMatchObject({
      ricsCode: 'F3',
      label: 'F3 Water',
      hasNotes: true,
    });
    expect(roof?.photoCount).toBe(3);
    expect(sections.some((item) => item.ricsCode === 'J1')).toBe(false);

    const neighbours = adjacentDeskReviewSection(sections, 'water');
    expect(neighbours.previous?.key).toBeTruthy();
    expect(neighbours.next?.key).toBeTruthy();
    expect(neighbours.previous?.key).not.toBe('water');
    expect(neighbours.next?.key).not.toBe('water');
  });

  it('opens the first section that already has notes or photos', () => {
    const sections = deskReviewSections(2, {
      noteKeys: ['electricity'],
    });
    expect(firstDeskReviewSectionKey(sections)).toBe('electricity');
  });
});
