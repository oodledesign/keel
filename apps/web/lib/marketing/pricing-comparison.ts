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
  'ozer-business-starter',
  'ozer-business',
] as const;

const PERSONAL_COMPARISON_COLUMNS: PricingComparisonPlanColumn[] = [
  { id: 'ozer-personal', label: 'Personal & family' },
  { id: 'ozer-business', label: 'Business' },
];

function workComparison(): SegmentPricingComparison {
  const cols = WORK_PLAN_IDS.map((id) => ({
    id,
    label:
      id === 'ozer-business-lite'
        ? 'Free'
        : id === 'ozer-business-starter'
          ? 'Starter'
          : 'Pro',
    highlighted: id === 'ozer-business',
  }));

  const v = (
    lite: PricingFeatureCell,
    starter: PricingFeatureCell,
    pro: PricingFeatureCell,
  ) =>
    Object.fromEntries(
      WORK_PLAN_IDS.map((id, i) => [id, [lite, starter, pro][i]!]),
    );

  return {
    planColumns: cols,
    groups: [
      {
        title: 'Workspace',
        rows: [
          {
            feature: 'Monthly price',
            hint: 'Starter and Pro use graduated seats. Extra seats stay cheaper than seat 1.',
            values: v('Free', 'From £14 / seat', 'From £29 / seat'),
          },
          {
            feature: 'Billable seats',
            hint: 'Owners, admins, staff, and contractors count as paid seats.',
            values: v(
              'Up to 2 members',
              '£14 then £9 extra',
              '£29 then £22 extra',
            ),
          },
          {
            feature: 'Project guests',
            hint: 'External collaborators on a single project board — not paid seats.',
            values: v('1', '1 per billable seat', '3 per billable seat'),
          },
          {
            feature: 'Client portal contacts',
            hint: 'Clients viewing their portal — unlimited on every plan.',
            values: v('Unlimited', 'Unlimited', 'Unlimited'),
          },
          {
            feature: 'Share clients & projects with other workspaces',
            values: v(false, false, 'Unlimited (paid workspaces)'),
          },
          {
            feature: '14-day free trial',
            hint: 'On your first paid workspace — no card required.',
            values: v(false, true, true),
          },
          {
            feature: 'Apps marketplace',
            hint: 'Install Signatures, Site Studio, Media Generate, and future apps.',
            href: '/apps',
            values: v(true, true, true),
          },
          {
            feature: 'Team & brand settings',
            values: v(true, true, true),
          },
          {
            feature: 'Monthly AI credits',
            hint: 'Shared workspace pool. Pro scales with seats (3,000 + 1,500 per extra seat).',
            values: v('200', 'Workspace AI included', 'From 3,000 (scales)'),
          },
        ],
      },
      {
        title: 'CRM & delivery',
        rows: [
          {
            feature: 'Clients & pipeline',
            href: '/features/pipeline',
            values: v(false, true, true),
          },
          {
            feature: 'Jobs & projects',
            href: '/features/project-management',
            values: v(false, true, true),
          },
          {
            feature: 'Tasks & planner',
            href: '/features/planner',
            values: v(false, true, true),
          },
          {
            feature: 'Scheduling',
            values: v(false, true, true),
          },
          {
            feature: 'Invoices, proposals & contracts',
            href: '/features/invoicing',
            values: v(false, true, true),
          },
          {
            feature: 'Activity tracking',
            href: '/features/activity',
            values: v(false, true, true),
          },
          {
            feature: 'Client portal',
            href: '/features/client-portals',
            values: v(false, true, true),
          },
          {
            feature: 'Team & client messaging',
            href: '/features/messaging',
            values: v(false, true, true),
          },
          {
            feature: 'SOPs & playbook checklists',
            href: '/features/sops',
            values: v(false, true, true),
          },
          {
            feature: 'Docs & notes',
            href: '/features/notes',
            values: v(false, true, true),
          },
          {
            feature: 'Finances',
            href: '/features/finances',
            values: v(false, true, true),
          },
          {
            feature: 'Support tickets',
            values: v(false, true, true),
          },
          {
            feature: 'Websites',
            values: v(false, true, true),
          },
          {
            feature: 'Second Brain',
            href: '/features/second-brain',
            values: v(false, true, true),
          },
        ],
      },
      {
        title: 'Assistants',
        rows: [
          {
            feature: 'Meeting Assistant',
            href: '/features/desktop-assistant',
            values: v('5 hrs/mo', true, true),
          },
          {
            feature: 'Dictation',
            href: '/features/dictation',
            values: v(true, true, true),
          },
          {
            feature: 'Email Assistant',
            href: '/features/email-assistant',
            values: v('add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'AI Planner',
            href: '/features/planner',
            values: v(true, true, true),
          },
          {
            feature: 'Meeting coaching & auto task extraction',
            values: v(false, false, true),
          },
        ],
      },
      {
        title: 'Workspace add-ons',
        rows: [
          {
            feature: 'Signatures',
            href: '/apps/signatures',
            values: v('add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Site Studio',
            href: '/apps',
            values: v('add-on', 'add-on', 'add-on'),
          },
          {
            feature: 'Media Generate',
            href: '/apps',
            values: v('add-on', 'add-on', 'add-on'),
          },
        ],
      },
      {
        title: 'Support',
        rows: [
          {
            feature: 'Priority support',
            values: v(false, false, true),
          },
          {
            feature: 'Ozer subscription transaction fees',
            values: v('None', 'None', 'None'),
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
            hint: 'Mac meetings → tasks. Personal/Free: limited hours. Paid Business: unlimited.',
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
            values: v('200', 'From 3,000 on Pro'),
          },
        ],
      },
      {
        title: 'Pricing',
        rows: [
          {
            feature: 'Monthly price',
            values: v('Free', 'From £14 Starter / £29 Pro'),
          },
          {
            feature: 'Graduated seats',
            values: v(false, true),
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
