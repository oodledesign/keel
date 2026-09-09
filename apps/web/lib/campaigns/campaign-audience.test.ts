import { describe, expect, it } from 'vitest';

import {
  campaignAudienceListMissing,
  parseCampaignAudienceConfig,
} from './campaign-audience';

describe('campaign audience list drafts', () => {
  it('treats list type with a null or missing listId as incomplete, not invalid', () => {
    expect(
      campaignAudienceListMissing('list', {
        emails: [],
        clientIds: [],
        contactIds: [],
        listId: null,
      }),
    ).toBe(true);
    expect(campaignAudienceListMissing('list', { emails: [] })).toBe(true);
    expect(
      campaignAudienceListMissing('list', {
        listId: 'ce2cbe27-4272-43c9-8741-741fe5ef8222',
      }),
    ).toBe(false);
    expect(campaignAudienceListMissing('subscribers', { listId: null })).toBe(
      false,
    );
  });

  it('keeps a null listId when parsing the stored Bracketts-style config', () => {
    expect(
      parseCampaignAudienceConfig({
        emails: [],
        listId: null,
        clientIds: [],
        contactIds: [],
      }),
    ).toEqual({
      emails: [],
      clientIds: [],
      contactIds: [],
      listId: null,
    });
  });
});
