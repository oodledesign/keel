import { describe, expect, it } from 'vitest';

import type { BrochureImageSlot, BrochurePage } from '../brochure-document';
import {
  placeBrochureMedia,
  swapBrochureImageSlots,
  switchBrochurePageLayout,
} from '../switch-brochure-layout';

function img(
  id: string,
  extra: Partial<BrochureImageSlot> = {},
): BrochureImageSlot {
  return {
    type: 'image',
    mediaId: id,
    url: `https://cdn.example.com/${id}.jpg`,
    ...extra,
  };
}

const empty: BrochureImageSlot = { type: 'image', mediaId: null, url: null };

describe('switchBrochurePageLayout', () => {
  it('carries images into the new layout in order and drops the overflow', () => {
    const page: BrochurePage = {
      id: 'p1',
      layoutId: 'photo_grid_3',
      slots: { photo1: img('a'), photo2: img('b'), photo3: img('c') },
    };
    const next = switchBrochurePageLayout(page, 'photo_grid_2');
    expect(next.id).toBe('p1');
    expect(next.layoutId).toBe('photo_grid_2');
    expect(next.slots.photo1).toEqual(img('a'));
    expect(next.slots.photo2).toEqual(img('b'));
    expect(next.slots.photo3).toBeUndefined();
  });

  it('skips empty image slots when filling the new layout', () => {
    const page: BrochurePage = {
      id: 'p1',
      layoutId: 'photo_grid_2',
      slots: { photo1: empty, photo2: img('b', { fit: 'whole' }) },
    };
    const next = switchBrochurePageLayout(page, 'photo_full');
    expect(next.slots.photo).toEqual(img('b', { fit: 'whole' }));
  });

  it('keeps text with a matching key and section labels', () => {
    const page: BrochurePage = {
      id: 'p2',
      layoutId: 'description_highlights',
      sectionLabel: 'About',
      sectionNumber: '02',
      slots: {
        title: { type: 'text', text: 'The building' },
        body: { type: 'text', text: 'Bright open-plan space.' },
        highlights: { type: 'text', text: 'Parking' },
      },
    };
    const next = switchBrochurePageLayout(page, 'map_amenities');
    expect(next.sectionLabel).toBe('About');
    expect(next.sectionNumber).toBe('02');
    expect(next.slots.title).toEqual({ type: 'text', text: 'The building' });
    expect(next.slots.body).toEqual({
      type: 'text',
      text: 'Bright open-plan space.',
    });
    expect(next.slots.map?.type).toBe('map');
  });

  it('returns the same page when the layout is unchanged', () => {
    const page: BrochurePage = {
      id: 'p1',
      layoutId: 'photo_full',
      slots: { photo: img('a') },
    };
    expect(switchBrochurePageLayout(page, 'photo_full')).toBe(page);
  });
});

describe('placeBrochureMedia', () => {
  it('drops the fit and focus that belonged to the previous image', () => {
    expect(
      placeBrochureMedia({
        id: 'm1',
        mediaType: 'floorplan',
        url: 'https://cdn.example.com/plan.png',
        fileName: 'plan.png',
        isCover: false,
      }),
    ).toEqual({
      type: 'image',
      mediaId: 'm1',
      url: 'https://cdn.example.com/plan.png',
    });
  });
});

describe('swapBrochureImageSlots', () => {
  const pages: BrochurePage[] = [
    {
      id: 'p1',
      layoutId: 'photo_grid_2',
      slots: {
        photo1: img('a', { focus: 'top' }),
        photo2: img('b'),
      },
    },
    {
      id: 'p2',
      layoutId: 'floorplan',
      slots: {
        plan: img('plan', { fit: 'whole' }),
        caption: { type: 'text', text: 'Ground floor' },
      },
    },
  ];

  it('swaps two slots on the same page', () => {
    const next = swapBrochureImageSlots(
      pages,
      { pageId: 'p1', key: 'photo1' },
      { pageId: 'p1', key: 'photo2' },
    );
    expect(next[0]!.slots.photo1).toEqual(img('b'));
    expect(next[0]!.slots.photo2).toEqual(img('a', { focus: 'top' }));
    expect(next[1]).toBe(pages[1]);
  });

  it('swaps across pages, keeping fit and focus with each image', () => {
    const next = swapBrochureImageSlots(
      pages,
      { pageId: 'p1', key: 'photo1' },
      { pageId: 'p2', key: 'plan' },
    );
    expect(next[0]!.slots.photo1).toEqual(img('plan', { fit: 'whole' }));
    expect(next[1]!.slots.plan).toEqual(img('a', { focus: 'top' }));
  });

  it('ignores non-image slots', () => {
    const next = swapBrochureImageSlots(
      pages,
      { pageId: 'p1', key: 'photo1' },
      { pageId: 'p2', key: 'caption' },
    );
    expect(next).toBe(pages);
  });
});
