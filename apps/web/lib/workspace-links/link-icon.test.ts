import { describe, expect, it } from 'vitest';

import {
  GOOGLE_DOCS_ICON_URL,
  GOOGLE_SHEETS_ICON_URL,
  displayLinkIconUrl,
  linkIconKindFromUrl,
} from './link-icon';

describe('linkIconKindFromUrl', () => {
  it('detects Google Docs and Sheets', () => {
    expect(
      linkIconKindFromUrl('https://docs.google.com/document/d/abc/edit'),
    ).toBe('google_doc');
    expect(
      linkIconKindFromUrl(
        'https://docs.google.com/spreadsheets/d/abc/edit#gid=0',
      ),
    ).toBe('google_sheet');
    expect(linkIconKindFromUrl('https://sheets.google.com/d/abc')).toBe(
      'google_sheet',
    );
    expect(linkIconKindFromUrl('https://example.com/doc')).toBe('web');
  });
});

describe('displayLinkIconUrl', () => {
  it('uses Google product icons for Docs and Sheets', () => {
    expect(
      displayLinkIconUrl('https://docs.google.com/document/d/abc', null),
    ).toBe(GOOGLE_DOCS_ICON_URL);
    expect(
      displayLinkIconUrl('https://docs.google.com/spreadsheets/d/abc', null),
    ).toBe(GOOGLE_SHEETS_ICON_URL);
  });

  it('falls back to a stored favicon for other sites', () => {
    expect(
      displayLinkIconUrl('https://example.com', 'https://example.com/fav.png'),
    ).toBe('https://example.com/fav.png');
  });
});
