import 'server-only';

import {
  getCampaignUsage,
  listCampaignCreditBatches,
} from '~/lib/campaign-credits/ledger';
import {
  type CampaignUsageSnapshot,
  buildCampaignUsageSnapshot,
} from '~/lib/campaigns/campaign-usage';

export async function loadCampaignUsageSnapshot(input: {
  accountId: string;
  contactsUsed: number;
}): Promise<CampaignUsageSnapshot> {
  const [{ pool }, batches] = await Promise.all([
    getCampaignUsage(input.accountId),
    listCampaignCreditBatches(input.accountId).catch(() => []),
  ]);

  const packBalance = batches
    .filter(
      (batch) =>
        batch.source_type === 'topup_purchase' ||
        batch.source_type === 'pack_recurring',
    )
    .reduce((sum, batch) => sum + batch.units_remaining, 0);

  const monthlyRemaining = batches
    .filter(
      (batch) =>
        batch.source_type === 'monthly_grant' ||
        batch.source_type === 'admin_grant',
    )
    .reduce((sum, batch) => sum + batch.units_remaining, 0);

  return buildCampaignUsageSnapshot({
    planTier: pool.plan_tier,
    monthlyAllowance: pool.monthly_allowance,
    maxContacts: pool.max_contacts,
    contactBonus: pool.contact_bonus ?? 0,
    balance: pool.balance,
    packBalance,
    monthlyRemaining,
    contactsUsed: input.contactsUsed,
    cycleStart: pool.cycle_start,
    cycleEnd: pool.cycle_end,
  });
}
