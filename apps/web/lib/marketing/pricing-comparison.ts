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

const PROPERTY_PLAN_IDS = [
  'keel-property-starter',
  'keel-property-portfolio',
] as const;

const PERSONAL_COMPARISON_COLUMNS: PricingComparisonPlanColumn[] = [
  { id: 'keel-personal', label: 'Personal' },
  { id: 'keel-community', label: 'Community' },
  { id: 'keel-business-solo', label: 'Business' },
  { id: 'keel-property-starter', label: 'Property' },
];

const COMMUNITY_COMPARISON_COLUMNS: PricingComparisonPlanColumn[] = [
  { id: 'keel-personal', label: 'Personal' },
  { id: 'keel-community', label: 'Community', highlighted: true },
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
        title: 'Add-ons (per workspace)',
        rows: [
          {
            feature: 'Signatures',
            hint: '£9/mo per workspace.',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Rankly SEO',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Feedflow reviews & social',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Videos hosting',
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

function propertyComparison(): SegmentPricingComparison {
  const cols = PROPERTY_PLAN_IDS.map((id, index) => ({
    id,
    label: ['Starter', 'Portfolio'][index]!,
    highlighted: index === 1,
  }));

  const v = (starter: PricingFeatureCell, portfolio: PricingFeatureCell) =>
    Object.fromEntries(
      PROPERTY_PLAN_IDS.map((id, i) => [id, [starter, portfolio][i]!]),
    );

  return {
    planColumns: cols,
    groups: [
      {
        title: 'Portfolio limits',
        rows: [
          {
            feature: 'Monthly price',
            values: v('£19', '£29'),
          },
          {
            feature: 'Properties included',
            values: v('5', '20'),
          },
          {
            feature: '14-day free trial',
            values: v(true, true),
          },
        ],
      },
      {
        title: 'Property management',
        rows: [
          {
            feature: 'Property register & units',
            values: v(true, true),
          },
          {
            feature: 'Tenants & contacts',
            values: v(true, true),
          },
          {
            feature: 'Maintenance & jobs',
            values: v(true, true),
          },
          {
            feature: 'Property finances',
            values: v(true, true),
          },
          {
            feature: 'Tasks & reminders',
            values: v(true, true),
          },
          {
            feature: 'Docs & compliance notes',
            values: v(true, true),
          },
          {
            feature: 'Portfolio reporting',
            values: v(false, true),
          },
        ],
      },
    ],
  };
}

function communityComparison(): SegmentPricingComparison {
  const v = (personal: PricingFeatureCell, community: PricingFeatureCell) => ({
    'keel-personal': personal,
    'keel-community': community,
  });

  return {
    planColumns: COMMUNITY_COMPARISON_COLUMNS,
    groups: [
      {
        title: 'Workspace',
        rows: [
          {
            feature: 'Monthly price',
            values: v('Free', '£12'),
          },
          {
            feature: 'Members included',
            values: v('—', '3'),
          },
          {
            feature: '14-day free trial',
            values: v(false, true),
          },
        ],
      },
      {
        title: 'Group coordination',
        rows: [
          {
            feature: 'Personal tasks & planner',
            values: v(true, false),
          },
          {
            feature: 'Shared schedule & events',
            values: v(false, true),
          },
          {
            feature: 'Group tasks & rota',
            values: v(false, true),
          },
          {
            feature: 'Shared notes & files',
            values: v('Family only', true),
          },
          {
            feature: 'Member directory',
            values: v(false, true),
          },
          {
            feature: 'Group dashboard',
            values: v(false, true),
          },
        ],
      },
    ],
  };
}

function personalComparison(): SegmentPricingComparison {
  const v = (
    personal: PricingFeatureCell,
    community: PricingFeatureCell,
    business: PricingFeatureCell,
    property: PricingFeatureCell,
  ) => ({
    'keel-personal': personal,
    'keel-community': community,
    'keel-business-solo': business,
    'keel-property-starter': property,
  });

  return {
    planColumns: PERSONAL_COMPARISON_COLUMNS,
    groups: [
      {
        title: 'Always free',
        rows: [
          {
            feature: 'Personal command centre',
            values: v(true, false, false, false),
          },
          {
            feature: 'One family workspace',
            values: v(true, false, false, false),
          },
          {
            feature: 'Tasks, planner & people',
            values: v(true, false, false, false),
          },
          {
            feature: 'No credit card required',
            values: v(true, false, false, false),
          },
        ],
      },
      {
        title: 'Paid workspace types',
        rows: [
          {
            feature: 'Shared group schedule',
            values: v(false, true, false, false),
          },
          {
            feature: 'Clients, jobs & invoices',
            values: v(false, false, true, false),
          },
          {
            feature: 'Property & tenant management',
            values: v(false, false, false, true),
          },
          {
            feature: '14-day trial on first paid space',
            values: v(false, true, true, true),
          },
        ],
      },
    ],
  };
}

const SEGMENT_COMPARISONS: Record<SegmentSlug, SegmentPricingComparison> = {
  personal: personalComparison(),
  work: workComparison(),
  property: propertyComparison(),
  community: communityComparison(),
};

export function getSegmentPricingComparison(
  slug: SegmentSlug,
): SegmentPricingComparison | null {
  return SEGMENT_COMPARISONS[slug] ?? null;
}
