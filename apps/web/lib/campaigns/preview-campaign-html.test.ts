import { describe, expect, it } from 'vitest';

import { createStarterDocument } from './campaign-document';
import { mergeValuesForRecipient } from './merge-fields';
import { previewCampaignHtml } from './preview-campaign-html';

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
    expect(html).toContain('#unsubscribe');
    expect(html).not.toContain('{{first_name}}');
  });
});
