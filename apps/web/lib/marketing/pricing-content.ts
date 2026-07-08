import {
  BILLING_TRIAL_DAYS,
  formatGbp,
  getBillingProductPrice,
  listBusinessWorkspacePrices,
  PRICING_LAST_VERIFIED,
  translationLine,
  trialLabel,
  type BillingPlanPrice,
} from '~/lib/billing/billing-config-prices';

export { PRICING_LAST_VERIFIED, BILLING_TRIAL_DAYS };

export type ReplacedTool = {
  category: string;
  typicalMonthlyGbp: number;
  note: string;
};

/** Typical UK monthly costs for tools Ozer consolidates (illustrative market rates). */
export const REPLACED_STACK: ReplacedTool[] = [
  { category: 'Project management', typicalMonthlyGbp: 48, note: 'e.g. 4 seats on a common PM tool' },
  { category: 'CRM / pipeline', typicalMonthlyGbp: 45, note: 'entry CRM for a small team' },
  { category: 'Invoicing', typicalMonthlyGbp: 20, note: 'standalone invoicing SaaS' },
  { category: 'Client portal', typicalMonthlyGbp: 29, note: 'portal or client-flow tool' },
  { category: 'Meeting notes', typicalMonthlyGbp: 20, note: 'AI meeting note subscription' },
  { category: 'Time tracking', typicalMonthlyGbp: 12, note: 'automatic desktop time tracker per seat' },
  { category: 'Scheduling / tasks', typicalMonthlyGbp: 12, note: 'shared task or calendar layer' },
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
        ? ['Nothing above this tier — contact us if you need more than 15 members.']
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
  const tiers = listBusinessWorkspacePrices().filter((p) => p.monthlyPriceGbp > 0);
  const plan =
    tiers.find(
      (p) => p.maxTeamMembers != null && p.maxTeamMembers >= teamSize,
    ) ?? tiers[tiers.length - 1]!;

  return {
    plan,
    monthlyGbp: plan.monthlyPriceGbp,
    yearlyGbp: plan.yearlyPriceGbp ?? plan.monthlyPriceGbp * 12,
  };
}

export function philosophyLine(): string {
  return 'Flat price for the whole team, in pounds — no per-seat maths, no transaction fees on your Ozer subscription.';
}

export function ozerTeamAnnualGbp(): number {
  const team = getBillingProductPrice('ozer-business-team');
  return team?.yearlyPriceGbp ?? (team?.monthlyPriceGbp ?? 79) * 12;
}

export function pricingFaqs() {
  const team = getBillingProductPrice('ozer-business-team');
  const solo = getBillingProductPrice('ozer-business-solo');
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
      answer: `Business Solo is ${formatGbp(solo?.monthlyPriceGbp ?? 29)} per month for one member. Business Team is ${formatGbp(team?.monthlyPriceGbp ?? 79)} per month for up to ${team?.maxTeamMembers ?? 5} members. Business Scale is for up to 15 members — and you can request more users if you need them. You change tier — you do not multiply seats on Solo.`,
    },
    {
      question: 'Is there a free trial?',
      answer: `Personal and family are free forever. Business Lite is ${formatGbp(lite?.monthlyPriceGbp ?? 0)} per month. Paid workspaces include a ${BILLING_TRIAL_DAYS}-day free trial on your first paid workspace.`,
    },
    {
      question: 'How do I cancel?',
      answer:
        'Cancel from account billing settings. You keep access through the period you have already paid for. There is no long-term lock-in beyond the current billing period.',
    },
    {
      question: 'Does Ozer take a cut of my invoices?',
      answer:
        'No. Your Ozer subscription is a flat workspace price. Client card payments use Stripe; those card fees are Stripe’s, not an Ozer platform cut on your subscription.',
    },
  ];
}
