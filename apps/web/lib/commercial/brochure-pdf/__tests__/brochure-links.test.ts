import { describe, expect, it } from 'vitest';

import { DEFAULT_BROCHURE_DISPLAY_OPTIONS } from '../brochure-document';
import { resolveBrochureLinkButtons } from '../brochure-links';

describe('resolveBrochureLinkButtons', () => {
  it('defaults both buttons on when URLs exist', () => {
    expect(
      resolveBrochureLinkButtons({
        ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
        websiteListingUrl: 'https://www.bracketts.co.uk/property/4-london-road',
        slideshowBrochureUrl: 'https://app.ozer.so/share/brochure/abc123token',
      }),
    ).toEqual([
      {
        id: 'website',
        label: 'Website listing',
        url: 'https://www.bracketts.co.uk/property/4-london-road',
      },
      {
        id: 'slideshow',
        label: 'Online brochure',
        url: 'https://app.ozer.so/share/brochure/abc123token',
      },
    ]);
  });

  it('hides a button when its URL is missing', () => {
    expect(
      resolveBrochureLinkButtons({
        showWebsiteListingButton: true,
        showSlideshowBrochureButton: true,
        websiteListingUrl: 'https://www.bracketts.co.uk/listing',
        slideshowBrochureUrl: null,
      }),
    ).toEqual([
      {
        id: 'website',
        label: 'Website listing',
        url: 'https://www.bracketts.co.uk/listing',
      },
    ]);
  });

  it('rejects private or non-http URLs', () => {
    expect(
      resolveBrochureLinkButtons({
        websiteListingUrl: 'http://192.168.1.10/listing',
        slideshowBrochureUrl: 'javascript:alert(1)',
      }),
    ).toEqual([]);
  });

  it('honours settings flags even when URLs exist', () => {
    expect(
      resolveBrochureLinkButtons({
        showWebsiteListingButton: false,
        showSlideshowBrochureButton: true,
        websiteListingUrl: 'https://www.bracketts.co.uk/listing',
        slideshowBrochureUrl: 'https://app.ozer.so/share/brochure/tok',
      }).map((button) => button.id),
    ).toEqual(['slideshow']);
  });
});
