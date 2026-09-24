import { describe, expect, it } from 'vitest';

import {
  buildOzerBrochureFeedFile,
  pickFeedBrochureDocument,
  shouldPublishOzerBrochureToFeed,
  withOzerBrochureFeedFile,
} from '../property-hive-feed-brochures';
import type { PropertyHiveFeedFile } from '../property-hive-feed-media';

const generated: PropertyHiveFeedFile = {
  name: 'brochure-v1.pdf',
  url: 'https://app.ozer.so/api/commercial/listing-brochure/listing-1/brochure-v1.pdf',
  type: '11',
  mediaType: 'brochure',
};

describe('shouldPublishOzerBrochureToFeed', () => {
  it('publishes a saved brochure document', () => {
    expect(
      shouldPublishOzerBrochureToFeed({
        shareEnabled: false,
        documents: [{ pages: [{ id: 'p1' }] }],
      }),
    ).toBe(true);
  });

  it('publishes an enabled share link with no saved pages', () => {
    expect(
      shouldPublishOzerBrochureToFeed({
        shareEnabled: true,
        documents: [{ pages: [] }],
      }),
    ).toBe(true);
  });

  it('skips listings that only have marketing copy', () => {
    expect(
      shouldPublishOzerBrochureToFeed({
        shareEnabled: false,
        documents: [],
      }),
    ).toBe(false);
  });
});

describe('pickFeedBrochureDocument', () => {
  it('uses the latest document that has pages', () => {
    const picked = pickFeedBrochureDocument([
      {
        listingId: '1',
        orientation: 'portrait',
        templateId: 'classic',
        pages: [{ id: 'old' }],
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        listingId: '1',
        orientation: 'landscape',
        templateId: 'editorial',
        pages: [],
        updatedAt: '2026-06-01T00:00:00Z',
      },
      {
        listingId: '1',
        orientation: 'portrait',
        templateId: 'compact',
        pages: [{ id: 'new' }],
        updatedAt: '2026-03-01T00:00:00Z',
      },
    ]);
    expect(picked?.templateId).toBe('compact');
  });
});

describe('withOzerBrochureFeedFile', () => {
  it('appends the generated PDF when no brochure file was uploaded', () => {
    const epc: PropertyHiveFeedFile = {
      name: 'epc.pdf',
      url: 'https://cdn.example/epc.pdf',
      type: '3',
      mediaType: 'epc',
    };
    expect(withOzerBrochureFeedFile([epc], generated)).toEqual([
      epc,
      generated,
    ]);
  });

  it('keeps an uploaded brochure instead of adding a second one', () => {
    const uploaded: PropertyHiveFeedFile = {
      name: 'particulars.jpg',
      url: 'https://cdn.example/particulars.jpg',
      type: '11',
      mediaType: 'brochure',
    };
    expect(withOzerBrochureFeedFile([uploaded], generated)).toEqual([uploaded]);
  });
});

describe('buildOzerBrochureFeedFile', () => {
  it('uses a pdf filename Property Hive can download', () => {
    const file = buildOzerBrochureFeedFile({
      siteUrl: 'https://app.ozer.so/',
      listingId: '881c760d-b384-4251-8c2a-c7349be95396',
      version: '2026-09-24T08:55:24.000Z',
    });
    expect(file.type).toBe('11');
    expect(file.name.endsWith('.pdf')).toBe(true);
    expect(file.url).toBe(
      'https://app.ozer.so/api/commercial/listing-brochure/881c760d-b384-4251-8c2a-c7349be95396/brochure-v20260924T085524000Z.pdf',
    );
  });
});
