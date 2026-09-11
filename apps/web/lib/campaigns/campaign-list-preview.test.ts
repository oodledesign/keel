import { describe, expect, it } from 'vitest';

import { CAMPAIGN_DOCUMENT_VERSION } from './campaign-document';
import type { CampaignDocument } from './campaign-document';
import { campaignListPreviewHints } from './campaign-list-preview';

function document(blocks: CampaignDocument['blocks']): CampaignDocument {
  return { version: CAMPAIGN_DOCUMENT_VERSION, blocks };
}

describe('campaignListPreviewHints', () => {
  it('falls back to subject when the document is empty', () => {
    expect(campaignListPreviewHints(null, '  Breakfast invite  ')).toEqual({
      heading: 'Breakfast invite',
      hasLogo: false,
      hasImage: false,
      hasButton: false,
      hasColumns: false,
      hasText: false,
    });
  });

  it('prefers the first heading over the subject', () => {
    const hints = campaignListPreviewHints(
      document([
        { id: 'logo', type: 'logo' },
        { id: 'h1', type: 'heading', text: 'You’re invited', level: 1 },
        {
          id: 'txt',
          type: 'text',
          html: '<p>Join us Thursday.</p>',
        },
        {
          id: 'cta',
          type: 'button',
          label: 'RSVP',
          href: 'https://example.com',
        },
      ]),
      'Test invite',
    );

    expect(hints.heading).toBe('You’re invited');
    expect(hints.hasLogo).toBe(true);
    expect(hints.hasText).toBe(true);
    expect(hints.hasButton).toBe(true);
    expect(hints.hasImage).toBe(false);
  });

  it('detects images in columns without reading html_body', () => {
    const hints = campaignListPreviewHints(
      document([
        {
          id: 'cols',
          type: 'columns',
          left: {
            kind: 'image',
            src: 'https://cdn.example.com/a.jpg',
            alt: 'A',
          },
          right: { kind: 'text', html: '<p>Right</p>' },
        },
      ]),
      'Two properties',
    );

    expect(hints.hasColumns).toBe(true);
    expect(hints.hasImage).toBe(true);
    expect(hints.heading).toBe('Two properties');
  });
});
