import type {
  DriveableProductTourId,
  ProductTourId,
} from '~/lib/product-tour/types';

export type TourChromeAction =
  | 'open-workspace-switcher'
  | 'open-new-menu'
  | 'open-profile-menu'
  | 'open-support';

type TourStepDef = {
  element?: string;
  title: string;
  description: string;
  /** Side for the popover when highlighting chrome in the top bar. */
  side?: 'left' | 'right' | 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  chromeAction?: TourChromeAction;
};

const PERSONAL_STEPS: TourStepDef[] = [
  {
    title: 'Welcome to Ozer',
    description:
      'A quick look at where things live. You can replay this anytime from Settings.',
  },
  {
    element: '[data-tour="sidebar"]',
    title: 'Your sidebar',
    description: 'Jump between Home, tasks, projects, planner, and email here.',
  },
  {
    element: '[data-tour="nav-home"]',
    title: 'Personal home',
    description: 'Your daily overview — shortcuts, tasks, and what’s next.',
  },
  {
    element: '[data-tour="nav-tasks"]',
    title: 'Tasks',
    description: 'Track to-dos across personal life and workspaces.',
  },
  {
    element: '[data-tour="nav-projects"]',
    title: 'Projects',
    description: 'Plan personal projects and keep workstreams organised.',
  },
  {
    element: '[data-tour="nav-planner"]',
    title: 'Planner',
    description: 'See your calendar and schedule in one place.',
  },
  {
    element: '[data-tour="nav-email"]',
    title: 'Email',
    description: 'Your personal email assistant for triage and replies.',
  },
];

const COMMERCIAL_STEPS: TourStepDef[] = [
  {
    title: 'Welcome to your agency workspace',
    description:
      'Here’s where disposals, WIP, and contacts live. Replay anytime from Settings.',
  },
  {
    element: '[data-tour="sidebar"]',
    title: 'Agency navigation',
    description: 'Everything for commercial agency ops lives in this sidebar.',
  },
  {
    element: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    description: 'Agency home — activity, matches, and what needs attention.',
  },
  {
    element: '[data-tour="nav-disposals"]',
    title: 'Disposals',
    description: 'Listings you’re marketing — status, team, and matches.',
  },
  {
    element: '[data-tour="nav-wip"]',
    title: 'WIP',
    description: 'Instructions and pipeline stages for live deals.',
  },
  {
    element: '[data-tour="nav-contacts"]',
    title: 'Contacts',
    description:
      'Companies and people linked to your disposals — landlords, applicants, and agents.',
  },
  {
    element: '[data-tour="nav-requirements"]',
    title: 'Requirements',
    description: 'Applicant briefs ready to match against disposals.',
  },
  {
    element: '[data-tour="nav-insights"]',
    title: 'Insights',
    description: 'Reports and commercial performance views.',
  },
];

const WORK_DESIGN_STEPS: TourStepDef[] = [
  {
    title: 'Welcome to your workspace',
    description:
      'A quick tour of the main tools. Replay anytime from Settings.',
  },
  {
    element: '[data-tour="sidebar"]',
    title: 'Workspace navigation',
    description: 'Projects, clients, and day-to-day ops live here.',
  },
  {
    element: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    description: 'Your workspace overview and what’s moving today.',
  },
  {
    element: '[data-tour="nav-projects"]',
    title: 'Projects',
    description: 'Active jobs and delivery workstreams.',
  },
  {
    element: '[data-tour="nav-clients"]',
    title: 'Clients',
    description: 'Client records and related activity.',
  },
  {
    element: '[data-tour="nav-tasks"]',
    title: 'Tasks',
    description: 'Team tasks tied to this workspace.',
  },
  {
    element: '[data-tour="nav-invoices"]',
    title: 'Invoices',
    description: 'Billing and invoices for this workspace.',
  },
];

const WORK_PROPERTY_STEPS: TourStepDef[] = [
  {
    title: 'Welcome to your property workspace',
    description:
      'Here’s the layout for property work. Replay anytime from Settings.',
  },
  {
    element: '[data-tour="sidebar"]',
    title: 'Workspace navigation',
    description: 'Property tools and shared ops live in this sidebar.',
  },
  {
    element: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    description: 'Your property business overview.',
  },
  {
    element: '[data-tour="nav-properties"]',
    title: 'Properties',
    description: 'Portfolio properties and related records.',
  },
  {
    element: '[data-tour="nav-clients"]',
    title: 'Tenants',
    description: 'Tenant and contact records for this workspace.',
  },
  {
    element: '[data-tour="nav-tasks"]',
    title: 'Tasks',
    description: 'Tasks for the team in this workspace.',
  },
];

/** Shared top-bar / chrome steps appended to every driveable tour. */
const CHROME_STEPS: TourStepDef[] = [
  {
    element: '[data-tour="workspace-switcher"]',
    title: 'Switch workspaces',
    description:
      'Jump between personal home and your team workspaces from here.',
    side: 'right',
    align: 'start',
    chromeAction: 'open-workspace-switcher',
  },
  {
    element: '[data-tour="new-menu"]',
    title: 'Create something new',
    description: 'Quickly add tasks, notes, and other records from New.',
    side: 'left',
    align: 'end',
    chromeAction: 'open-new-menu',
  },
  {
    element: '[data-tour="profile-menu"]',
    title: 'Your profile',
    description: 'Account settings, billing, docs, and sign out live here.',
    side: 'left',
    align: 'end',
    chromeAction: 'open-profile-menu',
  },
  {
    element: '[data-tour="support-help"]',
    title: 'Help & support',
    description: 'Open this anytime to chat with Ozer support.',
    side: 'left',
    align: 'end',
    chromeAction: 'open-support',
  },
];

const STEPS_BY_TOUR: Record<DriveableProductTourId, TourStepDef[]> = {
  personal: PERSONAL_STEPS,
  commercial_property: COMMERCIAL_STEPS,
  work_design: WORK_DESIGN_STEPS,
  work_property: WORK_PROPERTY_STEPS,
};

export function getProductTourStepDefs(tourId: ProductTourId): TourStepDef[] {
  if (
    tourId === 'default_landing_prompt' ||
    tourId === 'personal_nav_tour_hint'
  ) {
    return [];
  }

  return [...STEPS_BY_TOUR[tourId], ...CHROME_STEPS];
}

export function resolveTeamProductTourId(
  profile: string | null | undefined,
): Exclude<DriveableProductTourId, 'personal'> | null {
  if (profile === 'commercial_property') return 'commercial_property';
  if (profile === 'work_property') return 'work_property';
  if (
    profile === 'family' ||
    profile === 'community' ||
    profile === 'building_surveyor'
  ) {
    return null;
  }
  // Default work / design teams (and unknown work-like profiles).
  return 'work_design';
}
