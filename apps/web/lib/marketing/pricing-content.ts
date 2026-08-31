import {
  BILLING_TRIAL_DAYS,
  type BillingPlanPrice,
  PRICING_LAST_VERIFIED,
  formatGbp,
  getBillingProductPrice,
  listBusinessWorkspacePrices,
  translationLine,
  trialLabel,
} from '~/lib/billing/billing-config-prices';
import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';

export { PRICING_LAST_VERIFIED, BILLING_TRIAL_DAYS };

export type ReplacedTool = {
  category: string;
  typicalMonthlyGbp: number;
  note: string;
};

/** Typical UK monthly costs for tools Ozer consolidates (illustrative market rates). */
export const REPLACED_STACK: ReplacedTool[] = [
  {
    category: 'Project management',
    typicalMonthlyGbp: 48,
    note: 'e.g. 4 seats on a common PM tool',
  },
  {
    category: 'CRM / pipeline',
    typicalMonthlyGbp: 45,
    note: 'entry CRM for a small team',
  },
  {
    category: 'Invoicing',
    typicalMonthlyGbp: 20,
    note: 'standalone invoicing SaaS',
  },
  {
    category: 'Client portal',
    typicalMonthlyGbp: 29,
    note: 'portal or client-flow tool',
  },
  {
    category: 'Meeting notes',
    typicalMonthlyGbp: 20,
    note: 'AI meeting note subscription',
  },
  {
    category: 'Time tracking',
    typicalMonthlyGbp: 12,
    note: 'automatic desktop time tracker per seat',
  },
  {
    category: 'Scheduling / tasks',
    typicalMonthlyGbp: 12,
    note: 'shared task or calendar layer',
  },
];

export function replacedStackMonthlyTotal(): number {
  return REPLACED_STACK.reduce((sum, row) => sum + row.typicalMonthlyGbp, 0);
}

export function businessTierCards(): Array<
  BillingPlanPrice & {
    translation: string;
    trial: string;
    includes: string[];
    excludes: string[];
  }
> {
  const tiers = listBusinessWorkspacePrices();

  return tiers.map((plan, index) => {
    const higher = tiers.slice(index + 1);
    const excludes =
      higher.length === 0
        ? [
            'Nothing above this tier — use the seat calculator to add more billable seats.',
          ]
        : [
            ...higher.flatMap((h) =>
              h.features.filter(
                (f) =>
                  !plan.features.some(
                    (pf) => pf.toLowerCase() === f.toLowerCase(),
                  ) && !f.toLowerCase().startsWith('everything in'),
              ),
            ),
          ];

    const uniqueExcludes = [...new Set(excludes)].filter(
      (line) => !plan.features.includes(line),
    );

    return {
      ...plan,
      translation: translationLine(plan),
      trial: trialLabel(plan),
      includes: plan.features,
      excludes:
        uniqueExcludes.length > 0
          ? uniqueExcludes
          : ['See higher tiers for larger seat limits.'],
    };
  });
}

export function annualCostForTeamSize(teamSize: number): {
  plan: BillingPlanPrice;
  monthlyGbp: number;
  yearlyGbp: number;
} {
  const plan = getBillingProductPrice('ozer-business')!;
  const seats = Math.max(1, teamSize);
  const monthlyGbp = estimateMonthlyGbp(seats);

  return {
    plan,
    monthlyGbp,
    yearlyGbp: monthlyGbp * 10,
  };
}

export function philosophyLine(): string {
  return 'Free, Starter, and Pro in pounds. Starter is £14 for seat 1 then £9 for each extra seat. Pro is £29 for seat 1 then £22 for each extra seat. No transaction fees on your subscription.';
}

export function ozerTeamAnnualGbp(): number {
  return estimateMonthlyGbp(4) * 10;
}

export function pricingFaqs() {
  const business = getBillingProductPrice('ozer-business');
  const starter = getBillingProductPrice('ozer-business-starter');
  const lite = getBillingProductPrice('ozer-business-lite');

  return [
    {
      question: 'How is VAT handled?',
      answer:
        'Prices on this page are in GBP as configured in billing. VAT is applied at checkout by Stripe where required for your location and account status.',
    },
    {
      question: 'Where is Ozer data hosted?',
      answer:
        'Ozer is built for EU data residency. See the Trust Centre for how we handle UK GDPR and transfers.',
    },
    {
      question: 'What happens when the team grows?',
      answer: `Starter is ${formatGbp(starter?.monthlyPriceGbp ?? 14)} for seat 1, then £9 for every extra seat. Pro is ${formatGbp(business?.monthlyPriceGbp ?? 29)} for seat 1, then £22 for every extra seat. One shared AI credit pool covers drafts, summaries, coaching, and other model use — it scales with seats on Pro. Client portals stay unlimited.`,
    },
    {
      question: 'Is there a free trial?',
      answer: `Personal and family are free forever. Free is ${formatGbp(lite?.monthlyPriceGbp ?? 0)} per month. Paid workspaces include a ${BILLING_TRIAL_DAYS}-day free trial on your first paid workspace — no credit card required.`,
    },
    {
      question: 'How do I cancel?',
      answer:
        'Cancel from account billing settings. You keep access through the period you have already paid for. There is no long-term lock-in beyond the current billing period.',
    },
    {
      question: 'Does Ozer take a cut of my invoices?',
      answer:
        'No. Your Ozer subscription is a workspace seat price. Client card payments use Stripe; those card fees are Stripe’s, not an Ozer platform cut on your subscription.',
    },
  ];
}
