import { describe, expect, it } from 'vitest';

import { buildCampaignUsageSnapshot } from './campaign-usage';

describe('campaign usage snapshot', () => {
  it('soft-warns at 80% and hard-blocks when empty or over cap', () => {
    const warn = buildCampaignUsageSnapshot({
      planTier: 'starter',
      monthlyAllowance: 5000,
      maxContacts: 500,
      balance: 900,
      monthlyRemaining: 900,
      contactsUsed: 400,
    });
    expect(warn.contactsSoftWarn).toBe(true);
    expect(warn.sendsSoftWarn).toBe(true);
    expect(warn.contactsBlocked).toBe(false);
    expect(warn.sendsBlocked).toBe(false);
    expect(warn.nextTierName).toBe('Growth');

    const blocked = buildCampaignUsageSnapshot({
      planTier: 'starter',
      monthlyAllowance: 5000,
      maxContacts: 500,
      balance: 0,
      monthlyRemaining: 0,
      contactsUsed: 501,
    });
    expect(blocked.contactsBlocked).toBe(true);
    expect(blocked.sendsBlocked).toBe(true);
  });

  it('treats pack balance as remaining send units without changing monthly cap', () => {
    const snapshot = buildCampaignUsageSnapshot({
      planTier: 'growth',
      monthlyAllowance: 20000,
      maxContacts: 2500,
      contactBonus: 500,
      balance: 12000,
      packBalance: 2000,
      monthlyRemaining: 10000,
      contactsUsed: 100,
    });
    expect(snapshot.packBalance).toBe(2000);
    expect(snapshot.monthlyRemaining).toBe(10000);
    expect(snapshot.nextTierName).toBe('Pro');
  });
});
