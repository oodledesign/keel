import type { SegmentSlug } from './segment-landing-pages';

/** Included, not included, add-on, or a short text value (e.g. seat count). */
export type PricingFeatureCell = boolean | 'add-on' | string;

export type PricingComparisonRow = {
  feature: string;
  /** Short explanation for jargon or unclear features. */
  hint?: string;
  /** Marketing feature / app page for deeper reading. */
  href?: string;
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

const WORK_PLAN_IDS = ['ozer-business-lite', 'ozer-business'] as const;

const PERSONAL_COMPARISON_COLUMNS: PricingComparisonPlanColumn[] = [
  { id: 'ozer-personal', label: 'Personal & family' },
  { id: 'ozer-business', label: 'Business' },
];

function workComparison(): SegmentPricingComparison {
  const cols = WORK_PLAN_IDS.map((id, index) => ({
    id,
    label: ['Lite', 'Business'][index]!,
    highlighted: id === 'ozer-business',
  }));

  const v = (lite: PricingFeatureCell, business: PricingFeatureCell) =>
    Object.fromEntries(
      WORK_PLAN_IDS.map((id, i) => [id, [lite, business][i]!]),
    );

  return {
    planColumns: cols,
    groups: [
      {
        title: 'Workspace',
        rows: [
          {
            feature: 'Monthly price',
            hint: 'Business uses graduated per-seat pricing from £29 for seat 1.',
            values: v('Free', 'From £29 / seat'),
          },
          {
            feature: 'Billable seats',
            hint: 'Owners, admins, staff, and contractors count as paid seats.',
            values: v('Up to 3 members', 'Pay per seat (graduated)'),
          },
          {
            feature: 'Project guests',
            hint: 'External collaborators on a single project board — not paid seats.',
            values: v('1', '3 per billable seat'),
          },
          {
            feature: 'Client portal contacts',
            hint: 'Clients viewing their portal — unlimited on every plan.',
            values: v('Unlimited', 'Unlimited'),
          },
          {
            feature: 'Share clients & projects with other workspaces',
            values: v(false, 'Unlimited (paid workspaces)'),
          },
          {
            feature: '14-day free trial',
            hint: 'On your first paid workspace — no card required.',
            values: v(false, true),
          },
          {
            feature: 'Apps marketplace',
            hint: 'Install Signatures, Site Studio, Media Generate, and future apps.',
            href: '/apps',
            values: v(true, true),
          },
          {
            feature: 'Team & brand settings',
            values: v(true, true),
          },
          {
            feature: 'Monthly AI credits',
            hint: 'Shared workspace pool. Paid Business scales with seats (3k + 1.5k + 1k bands).',
            values: v('200', 'From 3,000 (scales with seats)'),
          },
        ],
      },
      {
        title: 'CRM & delivery',
        rows: [
          {
            feature: 'Clients & pipeline',
            href: '/features/pipeline',
            values: v(false, true),
          },
          {
            feature: 'Jobs & projects',
            href: '/features/project-management',
            values: v(false, true),
          },
          {
            feature: 'Tasks & planner',
            href: '/features/planner',
            values: v(false, true),
          },
          {
            feature: 'Scheduling',
            values: v(false, true),
          },
          {
            feature: 'Invoices, proposals & contracts',
            href: '/features/invoicing',
            values: v(false, true),
          },
          {
            feature: 'Activity tracking',
            href: '/features/activity',
            values: v(false, true),
          },
          {
            feature: 'Client portal',
            href: '/features/client-portals',
            values: v(false, true),
          },
          {
            feature: 'Team & client messaging',
            href: '/features/messaging',
            values: v(false, true),
          },
          {
            feature: 'SOPs & playbook checklists',
            href: '/features/sops',
            values: v(false, true),
          },
          {
            feature: 'Docs & notes',
            href: '/features/notes',
            values: v(false, true),
          },
          {
            feature: 'Finances',
            href: '/features/finances',
            values: v(false, true),
          },
          {
            feature: 'Support tickets',
            values: v(false, true),
          },
          {
            feature: 'Websites',
            values: v(false, true),
          },
          {
            feature: 'Second Brain',
            href: '/features/second-brain',
            values: v(false, true),
          },
        ],
      },
      {
        title: 'Assistants',
        rows: [
          {
            feature: 'Meeting Assistant',
            href: '/features/desktop-assistant',
            values: v('2 hrs/mo', true),
          },
          {
            feature: 'Dictation',
            href: '/features/dictation',
            values: v(true, true),
          },
          {
            feature: 'Email Assistant',
            href: '/features/email-assistant',
            values: v('add-on', 'add-on'),
          },
          {
            feature: 'AI Planner',
            href: '/features/planner',
            values: v(true, true),
          },
        ],
      },
      {
        title: 'Workspace add-ons',
        rows: [
          {
            feature: 'Signatures',
            href: '/apps/signatures',
            values: v('add-on', 'add-on'),
          },
          {
            feature: 'Site Studio',
            href: '/apps',
            values: v('add-on', 'add-on'),
          },
          {
            feature: 'Media Generate',
            href: '/apps',
            values: v('add-on', 'add-on'),
          },
        ],
      },
      {
        title: 'Support',
        rows: [
          {
            feature: 'Priority support',
            values: v(false, true),
          },
          {
            feature: 'Ozer subscription transaction fees',
            values: v('None', 'None'),
          },
        ],
      },
    ],
  };
}

function personalComparison(): SegmentPricingComparison {
  const v = (personal: PricingFeatureCell, business: PricingFeatureCell) => ({
    'ozer-personal': personal,
    'ozer-business': business,
  });

  return {
    planColumns: PERSONAL_COMPARISON_COLUMNS,
    groups: [
      {
        title: 'Everyday planning',
        rows: [
          {
            feature: 'Personal tasks & planner',
            hint: 'Today view and day planning from every space you belong to.',
            href: '/features/planner',
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
            href: '/features/pipeline',
            values: v(false, true),
          },
        ],
      },
      {
        title: 'Assistants',
        rows: [
          {
            feature: 'Meeting Assistant',
            hint: 'Mac meetings → tasks. Personal/Lite: 2 hrs/mo. Solo+: unlimited.',
            href: '/features/desktop-assistant',
            values: v('2 hrs/mo', true),
          },
          {
            feature: 'Dictation',
            hint: 'Bundled with Meeting Assistant for Mac.',
            href: '/features/dictation',
            values: v(true, true),
          },
          {
            feature: 'Email Assistant',
            hint: 'Gmail sync and AI drafts. £9/mo personal add-on.',
            href: '/features/email-assistant',
            values: v('add-on', 'add-on'),
          },
          {
            feature: 'Monthly AI credits',
            hint: 'Allowance for AI features on your personal account.',
            values: v('200', '2,000'),
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
