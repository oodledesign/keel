/**
 * Which Ozer workspace has which features — shared by home (preview)
 * and pricing (full list). Honest to module seeds and public marketing.
 *
 * Surveyor is a first-class workspace in the product but is not on a
 * public segment landing yet — omit that column and note it as coming.
 */

export type WorkspaceFeatureCell = boolean | 'partial' | 'coming' | string;

export type WorkspaceFeatureColumnId = 'business' | 'commercial';

export type WorkspaceFeatureColumn = {
  id: WorkspaceFeatureColumnId;
  name: string;
  blurb: string;
  price: string;
  href: string;
  highlighted?: boolean;
};

export type WorkspaceFeatureRow = {
  id: string;
  feature: string;
  hint?: string;
  href?: string;
  /** Shown on the homepage before “Show all”. */
  preview?: boolean;
  values: Record<WorkspaceFeatureColumnId, WorkspaceFeatureCell>;
};

export const WORKSPACE_FEATURE_COLUMNS: WorkspaceFeatureColumn[] = [
  {
    id: 'business',
    name: 'Business',
    blurb: 'Studio / freelancer Workspace OS',
    price: 'From £14 Starter / £29 Pro',
    href: '/work',
    highlighted: true,
  },
  {
    id: 'commercial',
    name: 'Commercial property',
    blurb: 'Listings, circulation, portals, brochures',
    price: 'From £89/mo',
    href: '/commercial-property',
  },
];

export const WORKSPACE_FEATURE_SURVEYOR_NOTE =
  'A building surveyor workspace (enquiry → survey → report) is in the product and coming to public marketing shortly.';

/**
 * Coverage follows work / commercial-property module orders and
 * segment landing pages. Email assistant, planner, and activity are
 * Business (Pro / Mac) capabilities — not commercial-desk modules.
 */
export const WORKSPACE_FEATURE_ROWS: WorkspaceFeatureRow[] = [
  {
    id: 'clients',
    feature: 'Clients & CRM',
    href: '/features/pipeline',
    preview: true,
    values: { business: true, commercial: true },
  },
  {
    id: 'projects',
    feature: 'Projects & jobs',
    href: '/features/project-management',
    preview: true,
    values: { business: true, commercial: false },
  },
  {
    id: 'invoices',
    feature: 'Invoices',
    href: '/features/invoicing',
    preview: true,
    values: { business: true, commercial: false },
  },
  {
    id: 'pipeline',
    feature: 'Pipeline',
    hint: 'Business: enquiries to signed work. Commercial: instructions and requirements.',
    href: '/features/pipeline',
    preview: true,
    values: { business: true, commercial: true },
  },
  {
    id: 'tasks',
    feature: 'Tasks',
    href: '/features/tasks',
    preview: true,
    values: { business: true, commercial: true },
  },
  {
    id: 'notes',
    feature: 'Notes',
    href: '/features/notes',
    preview: true,
    values: { business: true, commercial: true },
  },
  {
    id: 'meetings',
    feature: 'Meetings & dictation',
    hint: 'Mac meeting recording and on-device dictation. Business has a meetings module; commercial desks use notes and tasks.',
    href: '/features/dictation',
    preview: true,
    values: { business: true, commercial: 'partial' },
  },
  {
    id: 'email',
    feature: 'Email assistant',
    hint: 'Included on Business Pro. Not a commercial-desk module.',
    href: '/features/email-assistant',
    preview: true,
    values: { business: true, commercial: false },
  },
  {
    id: 'activity',
    feature: 'Activity tracking (Mac)',
    hint: 'Ozer Assistant on Mac — assign app and website sessions to clients and projects.',
    href: '/features/activity',
    preview: true,
    values: { business: true, commercial: false },
  },
  {
    id: 'portals',
    feature: 'Client portals',
    href: '/features/client-portals',
    preview: true,
    values: { business: true, commercial: false },
  },
  {
    id: 'listings',
    feature: 'Commercial listings',
    hint: 'Disposals, units, media, and marketing for agency stock.',
    preview: true,
    values: { business: false, commercial: true },
  },
  {
    id: 'ios',
    feature: 'iOS app',
    hint: 'Native iPhone app in progress — tasks, notes, people, meetings and dictation. Not in the App Store yet.',
    preview: true,
    values: { business: 'coming', commercial: 'coming' },
  },
  {
    id: 'planner',
    feature: 'Planner',
    hint: 'Included on Business Pro.',
    href: '/features/planner',
    values: { business: true, commercial: false },
  },
  {
    id: 'sops',
    feature: 'SOPs & playbooks',
    href: '/features/sops',
    values: { business: true, commercial: true },
  },
  {
    id: 'websites',
    feature: 'Websites',
    values: { business: true, commercial: false },
  },
  {
    id: 'proposals',
    feature: 'Proposals',
    href: '/features/contracts',
    values: { business: true, commercial: true },
  },
  {
    id: 'contracts',
    feature: 'Contracts',
    href: '/features/contracts',
    values: { business: true, commercial: false },
  },
  {
    id: 'finances',
    feature: 'Finances',
    href: '/features/finances',
    values: { business: true, commercial: false },
  },
  {
    id: 'messaging',
    feature: 'Team & client messaging',
    href: '/features/messaging',
    values: { business: true, commercial: false },
  },
  {
    id: 'forms',
    feature: 'Forms',
    values: { business: true, commercial: true },
  },
  {
    id: 'circulation',
    feature: 'Circulation',
    hint: 'Applicant lists and mailing for commercial stock.',
    values: { business: false, commercial: true },
  },
  {
    id: 'brochures',
    feature: 'Online brochures',
    hint: 'Shareable branded slideshows for disposals.',
    values: { business: false, commercial: true },
  },
  {
    id: 'xml-feeds',
    feature: 'Portal XML feeds',
    hint: 'Rightmove Commercial, EACH, and Property Hive WordPress — included from seat 1.',
    values: { business: false, commercial: true },
  },
  {
    id: 'viewings',
    feature: 'Viewings',
    values: { business: false, commercial: true },
  },
  {
    id: 'leases',
    feature: 'Leases',
    values: { business: false, commercial: true },
  },
  {
    id: 'requirements',
    feature: 'Requirements & interest matching',
    values: { business: false, commercial: true },
  },
  {
    id: 'scheduling',
    feature: 'Scheduling & bookings',
    values: { business: true, commercial: false },
  },
  {
    id: 'second-brain',
    feature: 'Second Brain',
    href: '/features/second-brain',
    values: { business: true, commercial: false },
  },
];

export const WORKSPACE_FEATURE_PREVIEW_ROWS = WORKSPACE_FEATURE_ROWS.filter(
  (row) => row.preview,
);

export const WORKSPACE_FEATURE_EXTRA_ROWS = WORKSPACE_FEATURE_ROWS.filter(
  (row) => !row.preview,
);
