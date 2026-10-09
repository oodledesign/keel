import 'server-only';

import {
  countCampaignContactsUsed,
  getCampaignUsage,
  listCampaignCreditBatches,
} from '~/lib/campaign-credits/ledger';
import {
  type CampaignUsageSnapshot,
  buildCampaignUsageSnapshot,
} from '~/lib/campaigns/campaign-usage';

export async function loadCampaignUsageSnapshot(input: {
  accountId: string;
}): Promise<CampaignUsageSnapshot> {
  const [{ pool }, batches, contactsUsed] = await Promise.all([
    getCampaignUsage(input.accountId),
    listCampaignCreditBatches(input.accountId).catch(() => null),
    countCampaignContactsUsed(input.accountId).catch(() => 0),
  ]);

  const liveBatches = batches ?? [];

  const packBalance = liveBatches
    .filter(
      (batch) =>
        batch.source_type === 'topup_purchase' ||
        batch.source_type === 'pack_recurring',
    )
    .reduce((sum, batch) => sum + batch.units_remaining, 0);

  const monthlyRemaining = liveBatches
    .filter(
      (batch) =>
        batch.source_type === 'monthly_grant' ||
        batch.source_type === 'admin_grant',
    )
    .reduce((sum, batch) => sum + batch.units_remaining, 0);

  // The pool balance is a cache that still counts expired batches until the
  // daily sweep runs; live batches are what a send can actually spend.
  const balance = batches ? packBalance + monthlyRemaining : pool.balance;

  return buildCampaignUsageSnapshot({
    planTier: pool.plan_tier,
    monthlyAllowance: pool.monthly_allowance,
    maxContacts: pool.max_contacts,
    contactBonus: pool.contact_bonus ?? 0,
    balance,
    packBalance,
    monthlyRemaining,
    contactsUsed,
    cycleStart: pool.cycle_start,
    cycleEnd: pool.cycle_end,
  });
}
