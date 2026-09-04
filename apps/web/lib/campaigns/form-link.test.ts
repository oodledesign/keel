import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_FORM_URL_TOKEN,
  buildCampaignFormUrl,
  formUrlForMerge,
  isCampaignFormUrlToken,
} from './form-link';

describe('campaign form link', () => {
  it('recognises the form_url merge token', () => {
    expect(isCampaignFormUrlToken(CAMPAIGN_FORM_URL_TOKEN)).toBe(true);
    expect(isCampaignFormUrlToken('https://example.com')).toBe(false);
  });

  it('builds a public form URL and optionally prefills email', () => {
    const base = buildCampaignFormUrl({
      shareToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      siteUrl: 'https://app.ozer.test',
    });
    expect(base).toBe(
      'https://app.ozer.test/share/form/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    const withEmail = buildCampaignFormUrl({
      shareToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      siteUrl: 'https://app.ozer.test',
      prefillEmail: true,
      recipientEmail: 'ada@example.com',
    });
    expect(withEmail).toContain('email=ada%40example.com');
  });

  it('returns empty when no form is linked', () => {
    expect(
      formUrlForMerge({
        formLink: null,
        recipientEmail: 'ada@example.com',
      }),
    ).toBe('');
  });
});
