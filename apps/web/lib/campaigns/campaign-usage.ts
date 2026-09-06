/**
 * Campaign meter helpers (client-safe). Soft warn at 80%, hard block at 100%.
 */
import {
  CAMPAIGN_USAGE_SOFT_WARN_RATIO,
  nextCampaignUpgradeTier,
} from '~/lib/billing/campaign-pricing';

export type CampaignUsageSnapshot = {
  planTier: string;
  monthlyAllowance: number;
  maxContacts: number;
  contactBonus: number;
  balance: number;
  packBalance: number;
  monthlyRemaining: number;
  contactsUsed: number;
  cycleStart: string | null;
  cycleEnd: string | null;
  contactsRatio: number | null;
  sendsRatio: number | null;
  contactsSoftWarn: boolean;
  sendsSoftWarn: boolean;
  contactsBlocked: boolean;
  sendsBlocked: boolean;
  nextTierId: string | null;
  nextTierName: string | null;
};

export function buildCampaignUsageSnapshot(input: {
  planTier: string;
  monthlyAllowance: number;
  maxContacts: number;
  contactBonus?: number;
  balance: number;
  packBalance?: number;
  monthlyRemaining?: number;
  contactsUsed: number;
  cycleStart?: string | null;
  cycleEnd?: string | null;
}): CampaignUsageSnapshot {
  const maxContacts = Math.max(0, input.maxContacts);
  const monthlyAllowance = Math.max(0, input.monthlyAllowance);
  const balance = Math.max(0, input.balance);
  const packBalance = Math.max(0, input.packBalance ?? 0);
  const monthlyRemaining = Math.max(
    0,
    input.monthlyRemaining ?? Math.max(0, balance - packBalance),
  );
  const contactsUsed = Math.max(0, input.contactsUsed);

  const contactsRatio =
    maxContacts > 0 ? Math.min(1, contactsUsed / maxContacts) : null;
  const sendsUsed = Math.max(0, monthlyAllowance - monthlyRemaining);
  const sendsRatio =
    monthlyAllowance > 0 ? Math.min(1, sendsUsed / monthlyAllowance) : null;

  const next = nextCampaignUpgradeTier(input.planTier);

  return {
    planTier: input.planTier || 'none',
    monthlyAllowance,
    maxContacts,
    contactBonus: Math.max(0, input.contactBonus ?? 0),
    balance,
    packBalance,
    monthlyRemaining,
    contactsUsed,
    cycleStart: input.cycleStart ?? null,
    cycleEnd: input.cycleEnd ?? null,
    contactsRatio,
    sendsRatio,
    contactsSoftWarn:
      contactsRatio != null && contactsRatio >= CAMPAIGN_USAGE_SOFT_WARN_RATIO,
    sendsSoftWarn:
      sendsRatio != null && sendsRatio >= CAMPAIGN_USAGE_SOFT_WARN_RATIO,
    contactsBlocked: maxContacts > 0 && contactsUsed > maxContacts,
    sendsBlocked: balance <= 0 && monthlyAllowance > 0,
    nextTierId: next?.id ?? null,
    nextTierName: next?.name ?? null,
  };
}

export function campaignBillingHref(accountSlug: string): string {
  return `/home/${accountSlug}/settings/billing?addon=campaigns`;
}

export function describeCampaignQuota(input: {
  kind: 'sends' | 'contacts';
  needed?: number;
  have?: number;
  cap?: number;
  used?: number;
}): string {
  if (input.kind === 'sends') {
    const needed = input.needed ?? 0;
    const have = input.have ?? 0;
    return `Not enough send units. Need ${needed.toLocaleString()}, have ${have.toLocaleString()}. Upgrade Campaigns or buy a send pack in Billing.`;
  }
  const used = input.used ?? 0;
  const cap = input.cap ?? 0;
  return `This plan allows ${cap.toLocaleString()} contacts. The audience has ${used.toLocaleString()}. Upgrade or add a contact bump before sending.`;
}
