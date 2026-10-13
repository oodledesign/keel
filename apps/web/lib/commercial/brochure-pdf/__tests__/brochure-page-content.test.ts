import { describe, expect, it } from 'vitest';

import type {
  BrochureListing,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

import {
  BROCHURE_CONTENT_OPTIONS,
  contentOf,
  defaultLayoutFor,
} from '../brochure-content';
import {
  BROCHURE_LAYOUT_IDS,
  type BrochureDocument,
  type BrochureImageSlot,
  type BrochurePage,
  DEFAULT_BROCHURE_DISPLAY_OPTIONS,
} from '../brochure-document';
import { brochureOfficeLine, resolveBrochureFooter } from '../brochure-footer';
import { headingFieldsFor } from '../brochure-headings';
import {
  fillBrochureMergeFields,
  resolveBrochureMergeFields,
} from '../brochure-merge-fields';
import { buildBrochurePageContent } from '../build-brochure-document';
import {
  switchBrochurePageContent,
  switchBrochurePageLayout,
} from '../switch-brochure-layout';

function listing(overrides: Partial<BrochureListing> = {}): BrochureListing {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: '22222222-2222-2222-2222-222222222222',
    name: 'Lower Ground Floor, 4 London Road',
    addressLine1: 'Lower Ground Floor, 4 London Road',
    addressLine2: null,
    town: 'Crowborough',
    county: 'East Sussex',
    postcode: 'TN6 2TT',
    latitude: 51.058,
    longitude: 0.163,
    disposalType: 'to_let',
    tenure: 'leasehold',
    useClass: 'E',
    askingRentPence: 840_000,
    askingRentToPence: null,
    askingPricePence: null,
    rentFrequency: 'pa',
    hideRentFromMarketing: false,
    hidePriceFromMarketing: false,
    serviceChargePerSqft: null,
    ratesPayablePerSqft: null,
    estateChargePerSqft: null,
    sizeMinSqft: 821,
    sizeMaxSqft: 821,
    epcBand: null,
    epcRating: null,
    availableFrom: null,
    summary: 'Ground-floor retail.',
    description: 'A compact lock-up shop in Crowborough town centre.',
    locationCopy: 'Close to the High Street.',
    keyPoints: ['Town centre'],
    ...overrides,
  };
}

function brochureData(
  overrides: Partial<PublicBrochureData> = {},
): PublicBrochureData {
  return {
    token: '',
    listing: listing(),
    accountName: 'Bracketts',
    brand: {
      logoUrl: null,
      primaryColor: '#0D2344',
      secondaryColor: '#FFFFFF',
      accentColor: '#C8102E',
    },
    agents: [],
    images: [],
    floorplans: [
      {
        id: 'plan-1',
        mediaType: 'floorplan',
        url: 'https://cdn.example.com/plan-1.png',
        fileName: 'Ground floor',
        isCover: false,
      },
      {
        id: 'plan-2',
        mediaType: 'floorplan',
        url: 'https://cdn.example.com/plan-2.png',
        fileName: 'First floor',
        isCover: false,
      },
    ],
    branch: null,
    ...overrides,
  };
}

function img(id: string): BrochureImageSlot {
  return {
    type: 'image',
    mediaId: id,
    url: `https://cdn.example.com/${id}.jpg`,
  };
}

function text(page: Pick<BrochurePage, 'slots'>, key: string): string {
  const slot = page.slots[key];
  return slot?.type === 'text' ? slot.text : '';
}

const options = {
  templateId: 'classic' as const,
  orientation: 'landscape' as const,
};

describe('brochure content', () => {
  it('gives every layout exactly one content', () => {
    const listed = BROCHURE_CONTENT_OPTIONS.flatMap((o) => o.layouts);
    expect([...listed].sort()).toEqual([...BROCHURE_LAYOUT_IDS].sort());
    expect(contentOf('map_top')).toBe('location');
    expect(defaultLayoutFor('photos')).toBe('photo_full');
  });
});

describe('buildBrochurePageContent', () => {
  it('fills a summary page with the facts table', () => {
    const page = buildBrochurePageContent(brochureData(), 'summary', options);
    expect(page.layoutId).toBe('facts_table');
    const facts = page.slots.facts;
    expect(facts?.type === 'facts' ? facts.rows[0] : null).toEqual({
      label: 'Disposal',
      value: 'To let',
    });
    expect(text(page, 'title')).toBe('Summary');
  });

  it('picks the next floor plan not already in the brochure', () => {
    const page = buildBrochurePageContent(brochureData(), 'floorplan', {
      ...options,
      usedMediaIds: ['plan-1'],
    });
    const plan = page.slots.plan;
    expect(plan?.type === 'image' ? plan.mediaId : null).toBe('plan-2');
    expect(text(page, 'caption')).toBe('First floor');

    const allUsed = buildBrochurePageContent(brochureData(), 'floorplan', {
      ...options,
      usedMediaIds: ['plan-1', 'plan-2'],
    });
    const empty = allUsed.slots.plan;
    expect(empty?.type === 'image' ? empty.mediaId : 'missing').toBeNull();
  });

  it('comes back blank when the listing has nothing for it', () => {
    const page = buildBrochurePageContent(
      brochureData({
        listing: listing({ description: null, summary: null, keyPoints: [] }),
      }),
      'description',
      options,
    );
    expect(page.layoutId).toBe('description_highlights');
    expect(text(page, 'body')).toBe('');
  });

  it('defaults the contact title to "Strictly by appointment"', () => {
    const page = buildBrochurePageContent(brochureData(), 'contact', options);
    expect(text(page, 'title')).toBe('Strictly by appointment');
  });
});

describe('switchBrochurePageContent', () => {
  const summary: BrochurePage = {
    id: 'p2',
    layoutId: 'facts_table',
    slots: {
      title: { type: 'text', text: 'At a glance' },
      facts: { type: 'facts', rows: [{ label: 'Rent', value: '£8,400 pa' }] },
      photo1: img('a'),
    },
  };
  const description: Pick<BrochurePage, 'layoutId' | 'slots'> = {
    layoutId: 'description_highlights',
    slots: {
      title: { type: 'text', text: 'About the property' },
      body: { type: 'text', text: 'A compact lock-up shop.' },
      highlights: { type: 'text', text: '' },
    },
  };

  it('fills the page with the listing content and puts the old content aside', () => {
    const next = switchBrochurePageContent(summary, 'description', description);
    expect(next.id).toBe('p2');
    expect(next.layoutId).toBe('description_highlights');
    expect(text(next, 'body')).toBe('A compact lock-up shop.');
    expect(next.contentStash?.summary?.slots.title).toEqual(
      summary.slots.title,
    );
  });

  it('restores edits on switching back, without asking the listing again', () => {
    const away = switchBrochurePageContent(summary, 'description', description);
    const edited: BrochurePage = {
      ...away,
      slots: { ...away.slots, body: { type: 'text', text: 'My copy' } },
    };
    const back = switchBrochurePageContent(edited, 'summary', null);
    expect(back.layoutId).toBe('facts_table');
    expect(back.slots).toEqual(summary.slots);
    const again = switchBrochurePageContent(back, 'description', null);
    expect(text(again, 'body')).toBe('My copy');
  });

  it('carries photos into the new content and starts blank without listing content', () => {
    const next = switchBrochurePageContent(summary, 'photos', null);
    expect(next.layoutId).toBe('photo_full');
    expect(next.slots.photo).toEqual(img('a'));
  });

  it('keeps an Editorial section tab in step with the content', () => {
    const next = switchBrochurePageContent(
      { ...summary, sectionLabel: 'The offering', sectionNumber: '02' },
      'location',
      null,
    );
    expect(next.sectionLabel).toBe('Location');
    expect(next.sectionNumber).toBe('02');
  });
});

describe('page headings', () => {
  it('keeps a renamed small heading across layouts of the same content', () => {
    const page: BrochurePage = {
      id: 'loc',
      layoutId: 'map_amenities',
      slots: {
        title: { type: 'text', text: 'Location' },
        eyebrow: { type: 'text', text: 'Getting there' },
      },
    };
    const next = switchBrochurePageLayout(page, 'location_text');
    expect(text(next, 'eyebrow')).toBe('Getting there');
  });

  it('offers office and notice headings on the contact page only', () => {
    const contact = headingFieldsFor({ layoutId: 'contact' }, 'classic').map(
      (f) => [f.key, f.placeholder],
    );
    expect(contact).toEqual([
      ['eyebrow', 'Viewing & enquiries'],
      ['officeLabel', 'Office'],
      ['noticeLabel', 'Important notice'],
    ]);
    expect(headingFieldsFor({ layoutId: 'photo_grid_2' }, 'classic')).toEqual(
      [],
    );
    expect(
      headingFieldsFor({ layoutId: 'facts_table' }, 'editorial')[0]
        ?.placeholder,
    ).toBe('Property name');
  });
});

describe('merge fields', () => {
  const display = DEFAULT_BROCHURE_DISPLAY_OPTIONS;

  it('fills known fields in any case and leaves unknown ones as typed', () => {
    expect(
      fillBrochureMergeFields(
        'Rent {rent}, {Tenure}, {Use Class}, {Nope}',
        listing(),
        display,
      ),
    ).toBe('Rent £8,400 pa, Leasehold, E, {Nope}');
  });

  it('says "On application" when the rent is hidden from marketing', () => {
    const doc: BrochureDocument = {
      listingId: 'l',
      templateId: 'classic',
      pageSize: 'A4',
      orientation: 'landscape',
      pages: [
        {
          id: 'p',
          layoutId: 'facts_table',
          slots: {
            facts: {
              type: 'facts',
              rows: [{ label: 'Rent', value: '{Rent}' }],
            },
          },
        },
      ],
    };
    const resolved = resolveBrochureMergeFields(
      doc,
      listing({ hideRentFromMarketing: true }),
    );
    const facts = resolved.pages[0]!.slots.facts;
    expect(facts?.type === 'facts' ? facts.rows[0]!.value : null).toBe(
      'On application',
    );
    expect(doc.pages[0]!.slots.facts).not.toBe(facts);
  });

  it('returns the same document when there is nothing to fill', () => {
    const doc: BrochureDocument = {
      listingId: 'l',
      templateId: 'classic',
      pageSize: 'A4',
      orientation: 'landscape',
      pages: [
        {
          id: 'p',
          layoutId: 'photo_text',
          slots: { title: { type: 'text', text: 'Plain' } },
        },
      ],
    };
    expect(resolveBrochureMergeFields(doc, listing())).toBe(doc);
  });

  it('fills merge fields in the footer settings', () => {
    const doc: BrochureDocument = {
      listingId: 'l',
      templateId: 'classic',
      pageSize: 'A4',
      orientation: 'landscape',
      pages: [],
      settings: {
        footer: {
          officeText: 'Letting {Town}',
          noticeText: '{Disposal} · subject to contract',
          showPageNumbers: false,
        },
      },
    };
    expect(resolveBrochureMergeFields(doc, listing()).settings).toEqual({
      footer: {
        officeText: 'Letting Crowborough',
        noticeText: 'To let · subject to contract',
        showPageNumbers: false,
      },
    });
  });
});

describe('resolveBrochureFooter', () => {
  const office = 'Bracketts  ·  27/29 High Street  ·  01892 526111';

  it('shows the branch details, notice and page numbers by default', () => {
    expect(resolveBrochureFooter(undefined, office)).toEqual({
      office,
      notice: 'Subject to contract',
      pageNumbers: true,
    });
  });

  it('uses custom text, and falls back when it is left blank', () => {
    expect(
      resolveBrochureFooter(
        { officeText: 'Bracketts Commercial', noticeText: '  ' },
        office,
      ),
    ).toMatchObject({
      office: 'Bracketts Commercial',
      notice: 'Subject to contract',
    });
  });

  it('hides what is switched off', () => {
    expect(
      resolveBrochureFooter(
        { showOffice: false, showNotice: false, showPageNumbers: false },
        office,
      ),
    ).toEqual({ office: null, notice: null, pageNumbers: false });
  });

  it('joins the agency, branch address and phone', () => {
    expect(
      brochureOfficeLine('Bracketts', {
        address: '27/29 High Street\nTunbridge Wells',
        phone: ' 01892 526111 ',
      }),
    ).toBe('Bracketts  ·  27/29 High Street, Tunbridge Wells  ·  01892 526111');
    expect(brochureOfficeLine('Bracketts', null)).toBe('Bracketts');
  });
});
