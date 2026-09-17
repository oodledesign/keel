import { describe, expect, it } from 'vitest';

import {
  buildInlineHostSnippet,
  buildInlineIframeSnippet,
  buildInlineScriptSnippet,
  buildPopupEmbedSnippet,
  buildPopupScriptSnippet,
  buildPopupTriggerSnippet,
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

  it('mounts every matching inline host and stays idempotent', () => {
    const snippet = buildInlineScriptSnippet({
      shareToken: 'tok_abc',
      publicUrl,
      bind,
    });
    expect(snippet).toContain(
      `document.querySelectorAll('[data-ozer-form="'+token+'"]')`,
    );
    expect(snippet).not.toContain(
      `document.querySelector('[data-ozer-form="tok_abc"]')`,
    );
    expect(snippet).toContain(`var key='__ozerFormInline_'+token`);
    expect(snippet).toContain(`data-ozer-form-mounted`);
    expect(buildInlineHostSnippet({ shareToken: 'tok_abc', bind })).toBe(
      `<div data-ozer-form="tok_abc"></div>`,
    );
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

  it('supports attribute-only popup triggers when the script is included once', () => {
    const trigger = buildPopupTriggerSnippet({
      shareToken: 'tok_abc',
      bind: { bindsListing: true, listingId: 'listing-2' },
      buttonLabel: 'Book a viewing',
    });
    const script = buildPopupScriptSnippet({
      shareToken: 'tok_abc',
      publicUrl,
    });

    expect(trigger).toBe(
      '<button type="button" data-ozer-form-popup="tok_abc" data-listing="listing-2">Book a viewing</button>',
    );
    expect(trigger).not.toContain('<script>');
    expect(script).toContain('<script>');
    expect(script).not.toContain('<button');
    expect(script).toContain(
      `document.querySelectorAll('[data-ozer-form-popup="'+token+'"]')`,
    );
    expect(script).toContain('function open(trigger)');
    expect(script).toContain("trigger.getAttribute('data-listing')");
    expect(script).toContain(`var key='__ozerFormPopup_'+token`);
  });
});
