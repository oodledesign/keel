import { describe, expect, it } from 'vitest';

import { createStarterDocument } from './campaign-document';
import { mergeValuesForRecipient } from './merge-fields';
import {
  neutralizePreviewNavigation,
  previewCampaignHtml,
} from './preview-campaign-html';

describe('previewCampaignHtml', () => {
  it('compiles the document and substitutes sample merge fields', () => {
    const brand = {
      primary_color: '#0D2344',
      accent_color: '#57C87F',
      logo_url: 'https://cdn.example.com/logo.png',
      contact_email: 'hello@workspace.test',
    };

    const html = previewCampaignHtml({
      brand,
      document: createStarterDocument(brand),
      merge: mergeValuesForRecipient({
        displayName: 'Alex Taylor',
        email: 'alex@example.com',
      }),
    });

    expect(html).toContain('Hello Alex');
    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('Unsubscribe');
    expect(html).not.toContain('{{first_name}}');
    expect(html).toContain('data-ozer-preview-nav');
  });

  it('neutralizes link navigation in the preview HTML', () => {
    const brand = {
      primary_color: '#0D2344',
      accent_color: '#57C87F',
      logo_url: null as string | null,
      contact_email: 'hello@workspace.test',
    };

    const html = previewCampaignHtml({
      brand,
      htmlBody:
        '<p><a href="https://evil.example/go" target="_blank">Open</a></p>',
      merge: mergeValuesForRecipient({
        displayName: 'Alex Taylor',
        email: 'alex@example.com',
      }),
    });

    expect(html).toContain('data-ozer-preview-nav');
    expect(html).toContain('pointer-events:none');
    expect(html).toContain('href="#"');
    expect(html).not.toContain('https://evil.example/go');
    expect(html).not.toContain('target="_blank"');
  });
});

describe('neutralizePreviewNavigation', () => {
  it('rewrites anchors and injects a blocking style', () => {
    const html = neutralizePreviewNavigation(
      '<a href="https://example.com" target="_blank">Go</a>',
    );
    expect(html).toContain('href="#"');
    expect(html).not.toContain('target=');
    expect(html).toContain('data-ozer-preview-nav');
  });
});
