import { describe, expect, it } from 'vitest';

import type { BrochureImageSlot, BrochurePage } from '../brochure-document';
import {
  placeBrochureMedia,
  refreshBrochureMediaUrls,
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

  it('moves photos into the new photo layouts and leaves spare frames empty', () => {
    const page: BrochurePage = {
      id: 'p1',
      layoutId: 'photo_grid_3',
      slots: { photo1: img('a'), photo2: img('b'), photo3: img('c') },
    };
    const grid = switchBrochurePageLayout(page, 'photo_grid_4');
    expect(grid.slots.photo3).toEqual(img('c'));
    expect(grid.slots.photo4).toEqual(empty);

    const withText = switchBrochurePageLayout(page, 'photo_text');
    expect(withText.slots.photo).toEqual(img('a'));
    expect(withText.slots.body).toEqual({ type: 'text', text: '' });
  });

  it('keeps the cover photo and copy when switching cover layouts', () => {
    const page: BrochurePage = {
      id: 'cover',
      layoutId: 'cover_hero_band',
      slots: {
        hero: img('h', { focus: 'bottom' }),
        title: { type: 'text', text: '176 Tonbridge Road' },
      },
    };
    const next = switchBrochurePageLayout(page, 'cover_photo_band');
    expect(next.slots.hero).toEqual(img('h', { focus: 'bottom' }));
    expect(next.slots.title).toEqual({
      type: 'text',
      text: '176 Tonbridge Road',
    });
  });

  it('keeps the places and their limit across location layouts', () => {
    const map = {
      type: 'map' as const,
      latitude: 51.27,
      longitude: 0.5,
      amenities: [{ label: 'Maidstone East station', index: 1 }],
      limit: 3,
    };
    const page: BrochurePage = {
      id: 'loc',
      layoutId: 'map_amenities',
      slots: { body: { type: 'text', text: 'Close to the station.' }, map },
    };
    for (const layoutId of ['map_text', 'map_top', 'location_text'] as const) {
      const next = switchBrochurePageLayout(page, layoutId);
      expect(next.slots.map).toEqual(map);
      expect(next.slots.body).toEqual({
        type: 'text',
        text: 'Close to the station.',
      });
    }
  });

  it('restores facts and photos when switching away and back', () => {
    const facts = {
      type: 'facts' as const,
      rows: [
        { label: 'Disposal', value: 'To let' },
        { label: 'Size', value: '1,622 – 2,326 sq ft' },
      ],
    };
    const page: BrochurePage = {
      id: 'p2',
      layoutId: 'facts_table',
      slots: {
        title: { type: 'text', text: 'Summary' },
        facts,
        photo1: img('aerial', { fit: 'whole' }),
        photo2: empty,
      },
    };

    const description = switchBrochurePageLayout(
      page,
      'description_highlights',
    );
    expect(description.slots.facts).toBeUndefined();
    expect(description.stash).toEqual({
      facts,
      photo1: img('aerial', { fit: 'whole' }),
    });

    const back = switchBrochurePageLayout(description, 'facts_table');
    expect(back.slots.title).toEqual({ type: 'text', text: 'Summary' });
    expect(back.slots.facts).toEqual(facts);
    expect(back.slots.photo1).toEqual(img('aerial', { fit: 'whole' }));
    expect(back.stash).toBeUndefined();
  });

  it('does not stash a photo the new layout already shows', () => {
    const page: BrochurePage = {
      id: 'p1',
      layoutId: 'photo_full',
      slots: { photo: img('a') },
    };
    const grid = switchBrochurePageLayout(page, 'photo_grid_2');
    expect(grid.slots.photo1).toEqual(img('a'));
    expect(grid.stash).toBeUndefined();
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

describe('refreshBrochureMediaUrls', () => {
  it('points slots and stashed photos at the new links', () => {
    const pages: BrochurePage[] = [
      {
        id: 'p1',
        layoutId: 'photo_full',
        slots: { photo: img('a', { focus: 'top' }) },
        stash: { photo2: img('b') },
      },
      {
        id: 'p2',
        layoutId: 'description_highlights',
        slots: { title: { type: 'text', text: 'About' } },
      },
    ];
    const next = refreshBrochureMediaUrls(
      pages,
      new Map([
        ['a', 'https://cdn.example.com/a-new.jpg'],
        ['b', 'https://cdn.example.com/b-new.jpg'],
      ]),
    );
    expect(next[0]!.slots.photo).toEqual({
      ...img('a', { focus: 'top' }),
      url: 'https://cdn.example.com/a-new.jpg',
    });
    expect(next[0]!.stash?.photo2).toEqual({
      ...img('b'),
      url: 'https://cdn.example.com/b-new.jpg',
    });
    expect(next[1]).toBe(pages[1]);
  });

  it('returns the same pages when no link changed', () => {
    const pages: BrochurePage[] = [
      { id: 'p1', layoutId: 'photo_full', slots: { photo: img('a') } },
    ];
    expect(
      refreshBrochureMediaUrls(
        pages,
        new Map([['a', 'https://cdn.example.com/a.jpg']]),
      ),
    ).toBe(pages);
  });
});
