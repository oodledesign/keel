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

const WORK_PLAN_IDS = [
  'ozer-business-lite',
  'ozer-business-solo',
  'ozer-business-team',
  'ozer-business-scale',
] as const;

const PERSONAL_COMPARISON_COLUMNS: PricingComparisonPlanColumn[] = [
  { id: 'ozer-personal', label: 'Personal & family' },
  { id: 'ozer-business-solo', label: 'Business' },
];

function workComparison(): SegmentPricingComparison {
  const cols = WORK_PLAN_IDS.map((id, index) => ({
    id,
    label: ['Lite', 'Solo', 'Team', 'Scale'][index]!,
    highlighted: id === 'ozer-business-team',
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
            hint: 'Seats in this workspace. On Scale, request more users anytime.',
            values: v('3', '1', '5', '15'),
          },
          {
            feature: '14-day free trial',
            values: v(false, true, true, true),
          },
          {
            feature: 'Apps marketplace',
            hint: 'Install Signatures and other workspace apps on any business plan.',
            href: '/apps',
            values: v(true, true, true, true),
          },
          {
            feature: 'Monthly AI credits',
            hint: 'Shared workspace pool for AI drafts, summaries, and assistants. Buy more packs anytime from Billing.',
            values: v('500', '2,000', '5,000', '12,000'),
          },
        ],
      },
      {
        title: 'CRM & delivery',
        rows: [
          {
            feature: 'Clients & pipeline',
            hint: 'Leads, deals, and client records in one place.',
            href: '/features/pipeline',
            values: v(false, true, true, true),
          },
          {
            feature: 'Jobs & projects',
            hint: 'Delivery work linked to clients, tasks, and invoices.',
            href: '/features/project-management',
            values: v(false, true, true, true),
          },
          {
            feature: 'Tasks & planner',
            hint: 'Day planning and a shared today view across workspaces.',
            href: '/features/planner',
            values: v(false, true, true, true),
          },
          {
            feature: 'Invoices, proposals & contracts',
            href: '/features/invoicing',
            values: v(false, true, true, true),
          },
          {
            feature: 'Activity tracking',
            hint: 'Mac app sessions assigned to clients and projects.',
            href: '/features/activity',
            values: v(false, true, true, true),
          },
          {
            feature: 'Client portal',
            hint: 'Shared space for files, updates, and approvals.',
            href: '/features/client-portals',
            values: v(false, true, true, true),
          },
          {
            feature: 'Team & client messaging',
            href: '/features/messaging',
            values: v(false, true, true, true),
          },
          {
            feature: 'SOPs & playbook checklists',
            hint: 'Repeatable processes your team can follow job by job.',
            href: '/features/sops',
            values: v(false, true, true, true),
          },
          {
            feature: 'Docs & notes',
            href: '/features/notes',
            values: v(false, true, true, true),
          },
          {
            feature: 'Finances',
            hint: 'Studio income and expenses alongside delivery work.',
            href: '/features/finances',
            values: v(false, true, true, true),
          },
          {
            feature: 'Support tickets',
            values: v(false, true, true, true),
          },
        ],
      },
      {
        title: 'Assistants',
        rows: [
          {
            feature: 'Meeting Assistant',
            hint: 'Mac: record calls, extract tasks, sync to the right workspace.',
            href: '/features/desktop-assistant',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Dictation',
            hint: 'Press fn on Mac — punctuated text in any app. Included with Meeting Assistant.',
            href: '/features/dictation',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Email Assistant',
            hint: 'Gmail sync, action items, and draft replies. Personal add-on (£9/mo).',
            href: '/features/email-assistant',
            values: v('add-on', 'add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'AI Planner',
            hint: 'Today view and priorities across every workspace. Included with your personal home.',
            href: '/features/planner',
            values: v(true, true, true, true),
          },
        ],
      },
      {
        title: 'Workspace add-ons',
        rows: [
          {
            feature: 'Signatures',
            hint: 'Branded email signatures for Microsoft 365 & Google Workspace. Flat mailbox tiers from £9/mo.',
            href: '/apps/signatures',
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
    'ozer-personal': personal,
    'ozer-business-solo': business,
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
            hint: 'Mac meetings → tasks in the right workspace.',
            href: '/features/desktop-assistant',
            values: v('add-on', 'add-on'),
          },
          {
            feature: 'Dictation',
            hint: 'Included with Meeting Assistant for Mac.',
            href: '/features/dictation',
            values: v('add-on', 'add-on'),
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
