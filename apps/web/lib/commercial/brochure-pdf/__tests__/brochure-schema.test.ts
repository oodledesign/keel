import { describe, expect, it } from 'vitest';

import {
  BrochurePagePreviewSchema,
  BrochurePageSchema,
} from '~/home/[account]/listings/_lib/schema/brochure.schema';

import { BROCHURE_LAYOUT_IDS } from '../brochure-document';
import { createBlankBrochurePage } from '../build-brochure-document';

const LISTING_ID = '33dde750-8324-46b7-9913-4b0685e3f3fd';
const ACCOUNT_ID = 'c4e7c6b1-e4f0-43ee-a768-6b3782e50d62';

describe('brochure page schema', () => {
  it('accepts a blank page for every layout', () => {
    for (const layoutId of BROCHURE_LAYOUT_IDS) {
      const result = BrochurePageSchema.safeParse(
        createBlankBrochurePage(layoutId),
      );
      expect(result.success, layoutId).toBe(true);
    }
  });

  it('accepts a place limit on the map and rejects a negative one', () => {
    const page = createBlankBrochurePage('map_text');
    const map = page.slots.map;
    if (map?.type !== 'map') throw new Error('expected a map slot');

    const limited = {
      ...page,
      slots: { ...page.slots, map: { ...map, limit: 3 } },
    };
    expect(BrochurePageSchema.safeParse(limited).success).toBe(true);

    const negative = {
      ...page,
      slots: { ...page.slots, map: { ...map, limit: -1 } },
    };
    expect(BrochurePageSchema.safeParse(negative).success).toBe(false);
  });

  it('rejects unknown layouts', () => {
    expect(
      BrochurePageSchema.safeParse({
        ...createBlankBrochurePage('photo_full'),
        layoutId: 'photo_grid_9',
      }).success,
    ).toBe(false);
  });
});

describe('page preview schema', () => {
  it('needs at least one page and the id of the page to render', () => {
    const page = createBlankBrochurePage('photo_grid_4');
    const base = {
      listingId: LISTING_ID,
      accountId: ACCOUNT_ID,
      templateId: 'classic',
      orientation: 'landscape',
      pageId: page.id,
    };
    expect(
      BrochurePagePreviewSchema.safeParse({ ...base, pages: [page] }).success,
    ).toBe(true);
    expect(
      BrochurePagePreviewSchema.safeParse({ ...base, pages: [] }).success,
    ).toBe(false);
    expect(
      BrochurePagePreviewSchema.safeParse({
        ...base,
        pages: [page],
        pageId: '',
      }).success,
    ).toBe(false);
  });
});
