import {
  formatGbp,
  getBillingProductPrice,
  PRICING_LAST_VERIFIED,
} from '~/lib/billing/billing-config-prices';
import type { SourcedValue } from '~/lib/marketing/compare/types';

const OZER_PRICING = 'https://ozer.so/pricing';

export function ozerSourced<T>(value: T): SourcedValue<T> {
  return {
    value,
    sourceUrl: OZER_PRICING,
    lastVerified: PRICING_LAST_VERIFIED,
    verified: true,
  };
}

const team = getBillingProductPrice('keel-business-team');
const teamMonthly = team?.monthlyPriceGbp ?? 79;
const teamYearly = team?.yearlyPriceGbp ?? teamMonthly * 12;
const teamSeats = team?.maxTeamMembers ?? 5;

/** Business Team figures from billing.config.ts. */
export const OZER_TEAM_OF_FOUR = {
  pricingModel: ozerSourced(
    `Flat workspace price (not per seat); Business Team covers up to ${teamSeats} members`,
  ),
  teamOfFourGbpYear: ozerSourced(
    `${formatGbp(teamYearly)}/year on Business Team annual billing (${formatGbp(teamMonthly)}/month)`,
  ),
  teamOfFourAnnualGbp: ozerSourced(teamYearly),
  teamOfFourMonthlyGbp: ozerSourced(teamMonthly),
  transactionFees: ozerSourced(
    'Stripe card fees on client invoices only (no platform cut on subscription)',
  ),
  meetingIntelligence: ozerSourced(
    'Mac Assistant: on-device processing; audio not kept as a permanent recording',
  ),
  emailIntegration: ozerSourced('Gmail-connected email assistant in the Workspace OS'),
  clientPortal: ozerSourced('Branded client portals on the project record'),
  dataResidency: ozerSourced('EU data residency'),
  compliancePosture: ozerSourced(
    'UK company; UK GDPR / EU GDPR posture documented in Trust Centre',
  ),
  freeTrial: ozerSourced(
    'Personal & family free; 14-day trial on first paid workspace',
  ),
};
