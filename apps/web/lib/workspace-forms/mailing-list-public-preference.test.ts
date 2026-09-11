import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resubscribeMailingListPublicPreference,
  unsubscribeMailingListPublicPreference,
} from './mailing-list-public-preference';

const unsubscribeWorkspaceMailingListByToken = vi.fn();
const resubscribeWorkspaceMailingListByToken = vi.fn();
const unsubscribeCampaignRecipientByToken = vi.fn();
const resubscribeCampaignRecipientByToken = vi.fn();
const markCampaignRecipientsUnsubscribed = vi.fn();
const circulationUnsubscribe = vi.fn();
const circulationResubscribe = vi.fn();

vi.mock('./workspace-mailing-list', () => ({
  lookupWorkspaceMailingListByToken: vi.fn(),
  unsubscribeWorkspaceMailingListByToken: (...args: unknown[]) =>
    unsubscribeWorkspaceMailingListByToken(...args),
  resubscribeWorkspaceMailingListByToken: (...args: unknown[]) =>
    resubscribeWorkspaceMailingListByToken(...args),
}));

vi.mock('~/lib/campaigns/resolve-campaign-audience', () => ({
  lookupCampaignRecipientByToken: vi.fn(),
  unsubscribeCampaignRecipientByToken: (...args: unknown[]) =>
    unsubscribeCampaignRecipientByToken(...args),
  resubscribeCampaignRecipientByToken: (...args: unknown[]) =>
    resubscribeCampaignRecipientByToken(...args),
}));

vi.mock('~/lib/campaigns/campaigns.service', () => ({
  markCampaignRecipientsUnsubscribed: (...args: unknown[]) =>
    markCampaignRecipientsUnsubscribed(...args),
}));

vi.mock('~/lib/commercial/circulation/circulation.service', () => ({
  createCommercialCirculationService: () => ({
    unsubscribe: circulationUnsubscribe,
    resubscribe: circulationResubscribe,
  }),
}));

const TOKEN = 'a'.repeat(32);
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'dan@example.com';
const admin = {} as never;

describe('mailing list public preference circulation pause and restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribeCampaignRecipientByToken.mockResolvedValue(null);
    resubscribeCampaignRecipientByToken.mockResolvedValue(null);
    markCampaignRecipientsUnsubscribed.mockResolvedValue(undefined);
    circulationUnsubscribe.mockResolvedValue(undefined);
    circulationResubscribe.mockResolvedValue(undefined);
  });

  it('pauses commercial circulation for the same account and email on unsubscribe', async () => {
    unsubscribeWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'unsubscribed',
    });

    await expect(
      unsubscribeMailingListPublicPreference(admin, TOKEN),
    ).resolves.toEqual({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'unsubscribed',
    });

    expect(circulationUnsubscribe).toHaveBeenCalledWith(ACCOUNT_ID, EMAIL);
    expect(markCampaignRecipientsUnsubscribed).toHaveBeenCalledWith(
      admin,
      ACCOUNT_ID,
      EMAIL,
    );
    expect(circulationResubscribe).not.toHaveBeenCalled();
  });

  it('restores commercial circulation for the same account and email on resubscribe', async () => {
    resubscribeWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });

    await expect(
      resubscribeMailingListPublicPreference(admin, TOKEN),
    ).resolves.toEqual({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });

    expect(circulationResubscribe).toHaveBeenCalledWith(ACCOUNT_ID, EMAIL, {
      consentSource: 'unsubscribe_page_resubscribe',
    });
    expect(circulationUnsubscribe).not.toHaveBeenCalled();
  });

  it('does not pause or restore circulation when the mailing preference is suppressed', async () => {
    unsubscribeWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'suppressed',
    });
    resubscribeWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'suppressed',
    });

    await expect(
      unsubscribeMailingListPublicPreference(admin, TOKEN),
    ).resolves.toMatchObject({ marketingStatus: 'suppressed' });
    await expect(
      resubscribeMailingListPublicPreference(admin, TOKEN),
    ).resolves.toMatchObject({ marketingStatus: 'suppressed' });

    expect(circulationUnsubscribe).not.toHaveBeenCalled();
    expect(circulationResubscribe).not.toHaveBeenCalled();
    expect(markCampaignRecipientsUnsubscribed).not.toHaveBeenCalled();
  });
});
