import {
  PRICING_LAST_VERIFIED,
  formatGbp,
} from '~/lib/billing/billing-config-prices';
import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
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

/** Illustrative 4-seat Business total from graduated pricing. */
const fourSeatMonthly = estimateMonthlyGbp(4);
const fourSeatYearly = fourSeatMonthly * 10;

/** Business (4-seat example) figures from graduated pricing. */
export const OZER_TEAM_OF_FOUR = {
  pricingModel: ozerSourced(
    'Graduated seats: Starter from £14 then £9; Pro from £29 then £22. Extra seats stay cheaper than seat 1.',
  ),
  teamOfFourGbpYear: ozerSourced(
    `${formatGbp(fourSeatYearly)}/year for 4 billable seats on annual billing (${formatGbp(fourSeatMonthly)}/month)`,
  ),
  teamOfFourAnnualGbp: ozerSourced(fourSeatYearly),
  teamOfFourMonthlyGbp: ozerSourced(fourSeatMonthly),
  transactionFees: ozerSourced(
    'Stripe card fees on client invoices only (no platform cut on subscription)',
  ),
  meetingIntelligence: ozerSourced(
    'Mac Assistant: meetings, dictation, and desktop activity tracking; on-device processing; audio not kept as a permanent recording',
  ),
  emailIntegration: ozerSourced(
    'Gmail-connected email assistant in the Workspace OS',
  ),
  clientPortal: ozerSourced('Branded client portals on the project record'),
  dataResidency: ozerSourced('EU data residency'),
  compliancePosture: ozerSourced(
    'UK company; UK GDPR / EU GDPR posture documented in Trust Centre',
  ),
  freeTrial: ozerSourced(
    'Personal & family free; 14-day no-card trial on first paid workspace',
  ),
};
