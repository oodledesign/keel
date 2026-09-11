import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resubscribeCampaignRecipientByToken,
  unsubscribeCampaignRecipientByToken,
} from '~/lib/campaigns/resolve-campaign-audience';

import {
  PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED,
  resubscribeMailingListPublicPreference,
  unsubscribeMailingListPublicPreference,
} from './mailing-list-public-preference';
import {
  resubscribeWorkspaceMailingListByToken,
  unsubscribeWorkspaceMailingListByToken,
} from './workspace-mailing-list';

vi.mock('~/lib/campaigns/campaigns.service', () => ({
  markCampaignRecipientsUnsubscribed: vi.fn(),
}));

vi.mock('~/lib/campaigns/resolve-campaign-audience', () => ({
  lookupCampaignRecipientByToken: vi.fn(),
  resubscribeCampaignRecipientByToken: vi.fn(),
  unsubscribeCampaignRecipientByToken: vi.fn(),
}));

vi.mock('~/lib/commercial/circulation/circulation.service', () => ({
  createCommercialCirculationService: vi.fn(() => ({
    unsubscribe: vi.fn(),
  })),
}));

vi.mock('~/lib/workspace-forms/workspace-mailing-list', () => ({
  lookupWorkspaceMailingListByToken: vi.fn(),
  resubscribeWorkspaceMailingListByToken: vi.fn(),
  unsubscribeWorkspaceMailingListByToken: vi.fn(),
}));

const TOKEN = 'c'.repeat(32);

describe('mailing list public preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps preference write failures to a calm public error', async () => {
    vi.mocked(unsubscribeWorkspaceMailingListByToken).mockResolvedValueOnce(
      null,
    );
    vi.mocked(unsubscribeCampaignRecipientByToken).mockRejectedValueOnce(
      new Error(
        'new row for relation "workspace_mailing_preferences" violates check constraint "workspace_mailing_preferences_lawful_basis_check"',
      ),
    );

    await expect(
      unsubscribeMailingListPublicPreference({} as never, TOKEN),
    ).rejects.toThrow(PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED);
  });

  it('maps preference write failures on resubscribe to a calm public error', async () => {
    vi.mocked(resubscribeWorkspaceMailingListByToken).mockResolvedValueOnce(
      null,
    );
    vi.mocked(resubscribeCampaignRecipientByToken).mockRejectedValueOnce(
      new Error(
        'new row for relation "workspace_mailing_preferences" violates check constraint "workspace_mailing_preferences_lawful_basis_check"',
      ),
    );

    await expect(
      resubscribeMailingListPublicPreference({} as never, TOKEN),
    ).rejects.toThrow(PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED);
  });
});
