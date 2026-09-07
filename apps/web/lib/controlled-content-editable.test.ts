import { describe, expect, it } from 'vitest';

import { shouldApplyExternalRichTextHtml } from './controlled-content-editable';

describe('shouldApplyExternalRichTextHtml', () => {
  it('does not reapply the HTML the editor just emitted', () => {
    expect(
      shouldApplyExternalRichTextHtml({
        incoming: '<p>Hello world</p>',
        lastEmitted: '<p>Hello world</p>',
        currentInnerHtml: '<p>Hello world</p>',
      }),
    ).toBe(false);
  });

  it('does not reapply when sanitizer only normalizes tags', () => {
    expect(
      shouldApplyExternalRichTextHtml({
        incoming: '<div>Hi<br /></div>',
        lastEmitted: null,
        currentInnerHtml: '<div>Hi<br></div>',
      }),
    ).toBe(false);
  });

  it('applies a real external value change', () => {
    expect(
      shouldApplyExternalRichTextHtml({
        incoming: '<p>Updated intro</p>',
        lastEmitted: '<p>Hello</p>',
        currentInnerHtml: '<p>Hello</p>',
      }),
    ).toBe(true);
  });

  it('does not apply when the field is already empty', () => {
    expect(
      shouldApplyExternalRichTextHtml({
        incoming: '',
        lastEmitted: null,
        currentInnerHtml: '',
      }),
    ).toBe(false);
  });
});
