import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED,
  resubscribeMailingListPublicPreference,
  setMailingListPublicListPreference,
  unsubscribeMailingListPublicPreference,
} from './mailing-list-public-preference';

const lookupWorkspaceMailingListByToken = vi.fn();
const unsubscribeWorkspaceMailingListByToken = vi.fn();
const resubscribeWorkspaceMailingListByToken = vi.fn();
const unsubscribeCampaignRecipientByToken = vi.fn();
const resubscribeCampaignRecipientByToken = vi.fn();
const markCampaignRecipientsUnsubscribed = vi.fn();
const circulationUnsubscribe = vi.fn();
const circulationResubscribe = vi.fn();
const leaveAllPublicAudienceLists = vi.fn();
const listPublicAudiencePreferences = vi.fn();
const setPublicAudienceListSubscription = vi.fn();

vi.mock('~/lib/campaigns/campaign-list-preferences', () => ({
  leaveAllPublicAudienceLists: (...args: unknown[]) =>
    leaveAllPublicAudienceLists(...args),
  listPublicAudiencePreferences: (...args: unknown[]) =>
    listPublicAudiencePreferences(...args),
  setPublicAudienceListSubscription: (...args: unknown[]) =>
    setPublicAudienceListSubscription(...args),
}));

vi.mock('./workspace-mailing-list', () => ({
  lookupWorkspaceMailingListByToken: (...args: unknown[]) =>
    lookupWorkspaceMailingListByToken(...args),
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

const scheduleDynamicsMailingListSync = vi.fn();

vi.mock('~/lib/dynamics/sync.service', () => ({
  scheduleDynamicsMailingListSync: (...args: unknown[]) =>
    scheduleDynamicsMailingListSync(...args),
}));

const TOKEN = 'a'.repeat(32);
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'dan@example.com';
const admin = {} as never;

describe('mailing list public preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribeCampaignRecipientByToken.mockResolvedValue(null);
    resubscribeCampaignRecipientByToken.mockResolvedValue(null);
    markCampaignRecipientsUnsubscribed.mockResolvedValue(undefined);
    circulationUnsubscribe.mockResolvedValue(undefined);
    circulationResubscribe.mockResolvedValue(undefined);
    scheduleDynamicsMailingListSync.mockResolvedValue({ enqueued: true });
    leaveAllPublicAudienceLists.mockResolvedValue(undefined);
    listPublicAudiencePreferences.mockResolvedValue([]);
    setPublicAudienceListSubscription.mockResolvedValue(null);
    lookupWorkspaceMailingListByToken.mockResolvedValue(null);
  });

  it('maps preference write failures to a calm public error', async () => {
    unsubscribeWorkspaceMailingListByToken.mockResolvedValueOnce(null);
    unsubscribeCampaignRecipientByToken.mockRejectedValueOnce(
      new Error(
        'new row for relation "workspace_mailing_preferences" violates check constraint "workspace_mailing_preferences_lawful_basis_check"',
      ),
    );

    await expect(
      unsubscribeMailingListPublicPreference(admin, TOKEN),
    ).rejects.toThrow(PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED);
  });

  it('maps preference write failures on resubscribe to a calm public error', async () => {
    resubscribeWorkspaceMailingListByToken.mockResolvedValueOnce(null);
    resubscribeCampaignRecipientByToken.mockRejectedValueOnce(
      new Error(
        'new row for relation "workspace_mailing_preferences" violates check constraint "workspace_mailing_preferences_lawful_basis_check"',
      ),
    );

    await expect(
      resubscribeMailingListPublicPreference(admin, TOKEN),
    ).rejects.toThrow(PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED);
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

    expect(leaveAllPublicAudienceLists).toHaveBeenCalledWith(
      admin,
      ACCOUNT_ID,
      EMAIL,
    );
    expect(circulationUnsubscribe).toHaveBeenCalledWith(ACCOUNT_ID, EMAIL);
    expect(markCampaignRecipientsUnsubscribed).toHaveBeenCalledWith(
      admin,
      ACCOUNT_ID,
      EMAIL,
    );
    expect(circulationResubscribe).not.toHaveBeenCalled();
    expect(scheduleDynamicsMailingListSync).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ACCOUNT_ID,
        email: EMAIL,
        marketingOptedIn: false,
      }),
    );
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
    expect(scheduleDynamicsMailingListSync).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ACCOUNT_ID,
        email: EMAIL,
        marketingOptedIn: true,
      }),
    );
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

    expect(leaveAllPublicAudienceLists).toHaveBeenCalledWith(
      admin,
      ACCOUNT_ID,
      EMAIL,
    );
    expect(circulationUnsubscribe).not.toHaveBeenCalled();
    expect(circulationResubscribe).not.toHaveBeenCalled();
    expect(markCampaignRecipientsUnsubscribed).not.toHaveBeenCalled();
    expect(scheduleDynamicsMailingListSync).not.toHaveBeenCalled();
  });

  it('opts into a public list and resubscribes marketing when needed', async () => {
    const listId = '22222222-2222-4222-8222-222222222222';
    lookupWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'unsubscribed',
    });
    setPublicAudienceListSubscription.mockResolvedValue({
      id: listId,
      name: 'News',
      subscribed: true,
    });
    resubscribeWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });

    await expect(
      setMailingListPublicListPreference(admin, TOKEN, listId, true),
    ).resolves.toMatchObject({ marketingStatus: 'subscribed' });

    expect(setPublicAudienceListSubscription).toHaveBeenCalledWith({
      client: admin,
      accountId: ACCOUNT_ID,
      email: EMAIL,
      listId,
      subscribed: true,
    });
    expect(resubscribeWorkspaceMailingListByToken).toHaveBeenCalled();
  });

  it('does not clear a suppression when opting into a public list', async () => {
    const listId = '22222222-2222-4222-8222-222222222222';
    lookupWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'suppressed',
    });

    await expect(
      setMailingListPublicListPreference(admin, TOKEN, listId, true),
    ).resolves.toMatchObject({ marketingStatus: 'suppressed' });

    expect(setPublicAudienceListSubscription).not.toHaveBeenCalled();
    expect(resubscribeWorkspaceMailingListByToken).not.toHaveBeenCalled();
  });

  it('leaves a public list without changing marketing when already subscribed', async () => {
    const listId = '22222222-2222-4222-8222-222222222222';
    lookupWorkspaceMailingListByToken.mockResolvedValue({
      email: EMAIL,
      accountId: ACCOUNT_ID,
      marketingStatus: 'subscribed',
    });
    setPublicAudienceListSubscription.mockResolvedValue({
      id: listId,
      name: 'News',
      subscribed: false,
    });

    await expect(
      setMailingListPublicListPreference(admin, TOKEN, listId, false),
    ).resolves.toMatchObject({ marketingStatus: 'subscribed' });

    expect(setPublicAudienceListSubscription).toHaveBeenCalledWith({
      client: admin,
      accountId: ACCOUNT_ID,
      email: EMAIL,
      listId,
      subscribed: false,
    });
    expect(resubscribeWorkspaceMailingListByToken).not.toHaveBeenCalled();
    expect(unsubscribeWorkspaceMailingListByToken).not.toHaveBeenCalled();
  });
});
