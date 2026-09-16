import { describe, expect, it } from 'vitest';

import {
  buildInlineIframeSnippet,
  buildInlineScriptSnippet,
  buildPopupEmbedSnippet,
  formEmbedUrl,
  formUrlWithListing,
} from './form-embed';

describe('form embed snippets', () => {
  const publicUrl = 'https://app.ozer.test/share/form/tok_abc';
  const bind = { bindsListing: false, listingId: null };

  it('keeps listing-bound public URLs compatible', () => {
    expect(formUrlWithListing(publicUrl, bind)).toBe(publicUrl);
    expect(
      formUrlWithListing(publicUrl, {
        bindsListing: true,
        listingId: null,
      }),
    ).toBe(`${publicUrl}?listing=LISTING_ID`);
  });

  it('builds inline iframe and script snippets', () => {
    const listingUrl = formUrlWithListing(publicUrl, bind);
    expect(buildInlineIframeSnippet(listingUrl)).toContain(
      `src="${listingUrl}"`,
    );
    expect(
      buildInlineScriptSnippet({
        shareToken: 'tok_abc',
        publicUrl,
        bind,
      }),
    ).toContain('data-ozer-form="tok_abc"');
  });

  it('builds a popup snippet that opens embed=1 in a modal', () => {
    const snippet = buildPopupEmbedSnippet({
      shareToken: 'tok_abc',
      publicUrl,
      bind,
    });
    expect(snippet).toContain('data-ozer-form-popup="tok_abc"');
    expect(snippet).toContain('embed=1');
    expect(snippet).toContain('data-ozer-form-overlay');
    expect(formEmbedUrl(publicUrl, bind, { embed: true })).toBe(
      `${publicUrl}?embed=1`,
    );
  });

  it('adds listing bind attributes on popup buttons', () => {
    const snippet = buildPopupEmbedSnippet({
      shareToken: 'tok_abc',
      publicUrl,
      bind: { bindsListing: true, listingId: 'listing-1' },
    });
    expect(snippet).toContain('data-listing="listing-1"');
  });
});
