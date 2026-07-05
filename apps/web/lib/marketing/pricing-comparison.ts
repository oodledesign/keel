import type { SegmentSlug } from './segment-landing-pages';

/** Included, not included, add-on, or a short text value (e.g. seat count). */
export type PricingFeatureCell = boolean | 'add-on' | string;

export type PricingComparisonRow = {
  feature: string;
  hint?: string;
  values: Record<string, PricingFeatureCell>;
};

export type PricingComparisonGroup = {
  title: string;
  rows: PricingComparisonRow[];
};

export type PricingComparisonPlanColumn = {
  id: string;
  label: string;
  highlighted?: boolean;
};

export type SegmentPricingComparison = {
  planColumns: PricingComparisonPlanColumn[];
  groups: PricingComparisonGroup[];
};

const WORK_PLAN_IDS = [
  'keel-business-lite',
  'keel-business-solo',
  'keel-business-team',
  'keel-business-scale',
] as const;

const PERSONAL_COMPARISON_COLUMNS: PricingComparisonPlanColumn[] = [
  { id: 'keel-personal', label: 'Personal & family' },
  { id: 'keel-business-solo', label: 'Business' },
];

function workComparison(): SegmentPricingComparison {
  const cols = WORK_PLAN_IDS.map((id, index) => ({
    id,
    label: ['Lite', 'Solo', 'Team', 'Scale'][index]!,
    highlighted: id === 'keel-business-team',
  }));

  const v = (
    lite: PricingFeatureCell,
    solo: PricingFeatureCell,
    team: PricingFeatureCell,
    scale: PricingFeatureCell,
  ) =>
    Object.fromEntries(
      WORK_PLAN_IDS.map((id, i) => [id, [lite, solo, team, scale][i]!]),
    );

  return {
    planColumns: cols,
    groups: [
      {
        title: 'Workspace',
        rows: [
          {
            feature: 'Monthly price',
            values: v('Free', '£29', '£79', '£149'),
          },
          {
            feature: 'Team members included',
            hint: 'Additional seats may be available on request.',
            values: v('3', '1', '5', '15'),
          },
          {
            feature: '14-day free trial',
            values: v(false, true, true, true),
          },
          {
            feature: 'Apps marketplace',
            hint: 'Install Signatures and future add-ons.',
            values: v(true, false, false, false),
          },
        ],
      },
      {
        title: 'CRM & delivery',
        rows: [
          {
            feature: 'Clients & pipeline',
            values: v(false, true, true, true),
          },
          {
            feature: 'Jobs & projects',
            values: v(false, true, true, true),
          },
          {
            feature: 'Invoices, proposals & contracts',
            values: v(false, true, true, true),
          },
          {
            feature: 'Client portal',
            values: v(false, true, true, true),
          },
          {
            feature: 'Team & client messaging',
            values: v(false, true, true, true),
          },
          {
            feature: 'SOPs & playbook checklists',
            values: v(false, true, true, true),
          },
          {
            feature: 'Docs, notes & finances',
            values: v(false, true, true, true),
          },
          {
            feature: 'Support tickets',
            values: v(false, true, true, true),
          },
        ],
      },
      {
        title: 'Workspace add-ons',
        rows: [
          {
            feature: 'Signatures',
            hint: 'Flat mailbox tiers from £9/mo.',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
        ],
      },
      {
        title: 'Support',
        rows: [
          {
            feature: 'Priority support',
            values: v(false, false, false, true),
          },
        ],
      },
    ],
  };
}

function personalComparison(): SegmentPricingComparison {
  const v = (personal: PricingFeatureCell, business: PricingFeatureCell) => ({
    'keel-personal': personal,
    'keel-business-solo': business,
  });

  return {
    planColumns: PERSONAL_COMPARISON_COLUMNS,
    groups: [
      {
        title: 'Everyday planning',
        rows: [
          {
            feature: 'Personal tasks & planner',
            values: v(true, true),
          },
          {
            feature: 'Family workspace',
            values: v(true, false),
          },
          {
            feature: 'Today view across spaces',
            values: v(true, true),
          },
          {
            feature: 'Clients, pipeline & invoices',
            values: v(false, true),
          },
        ],
      },
      {
        title: 'Pricing',
        rows: [
          {
            feature: 'Monthly price',
            values: v('Free', 'From £29'),
          },
          {
            feature: 'Per-seat billing',
            values: v(false, false),
          },
        ],
      },
    ],
  };
}

export function getSegmentPricingComparison(
  slug: SegmentSlug,
): SegmentPricingComparison | null {
  if (slug === 'work') return workComparison();
  if (slug === 'personal') return personalComparison();
  return null;
}
