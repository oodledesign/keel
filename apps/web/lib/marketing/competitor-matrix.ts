export type CompetitorMatrixCell = boolean | 'partial';

export type CompetitorMatrixColumn = {
  id: string;
  name: string;
  blurb: string;
  /** Short mark for the column header chip */
  initials: string;
  highlighted?: boolean;
  /** Short price label for the footer row */
  price: string;
};

export type CompetitorMatrixRow = {
  id: string;
  feature: string;
  /** Optional fuller wording for hover / screen readers */
  hint?: string;
  /** Shown before “Show all”; keep these as the strongest differentiators */
  preview?: boolean;
  values: Record<string, CompetitorMatrixCell>;
};

export const COMPETITOR_MATRIX_COLUMNS: CompetitorMatrixColumn[] = [
  {
    id: 'ozer',
    name: 'Ozer',
    blurb: 'Ideal for freelancers and small studios',
    initials: 'Oz',
    highlighted: true,
    price: 'From £29/mo',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    blurb: 'Ideal for service-based small teams',
    initials: 'Bl',
    price: 'From $33/mo',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    blurb: 'Ideal for mid–large enterprise sales',
    initials: 'HS',
    price: '$45–$3,600/mo',
  },
  {
    id: 'monday',
    name: 'monday.com',
    blurb: 'Ideal for large-team task management',
    initials: 'mo',
    price: 'From $24/mo',
  },
  {
    id: 'zoho',
    name: 'Zoho',
    blurb: 'Ideal for mid–large marketing teams',
    initials: 'Zo',
    price: '$49–249/mo',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    blurb: 'Ideal for managing sales pipelines',
    initials: 'Pd',
    price: '$14–$99/mo',
  },
  {
    id: 'honeybook',
    name: 'HoneyBook',
    blurb: 'Ideal for freelancer collaboration',
    initials: 'HB',
    price: 'From $39/mo',
  },
];

/**
 * Indicative feature coverage by product family / mid-tier positioning.
 * Prefer Ozer strengths that are genuinely distinctive; competitors may
 * offer similar capability on higher plans or via add-ons.
 */
export const COMPETITOR_MATRIX_ROWS: CompetitorMatrixRow[] = [
  {
    id: 'clients',
    feature: 'Clients & CRM',
    preview: true,
    values: {
      ozer: true,
      bloom: true,
      hubspot: true,
      monday: true,
      zoho: true,
      pipedrive: true,
      honeybook: true,
    },
  },
  {
    id: 'projects',
    feature: 'Projects & jobs',
    preview: true,
    values: {
      ozer: true,
      bloom: true,
      hubspot: true,
      monday: true,
      zoho: true,
      pipedrive: 'partial',
      honeybook: true,
    },
  },
  {
    id: 'email',
    feature: 'AI email assistant',
    hint: 'CRM categorises email, extracts tasks, and auto-drafts replies',
    preview: true,
    values: {
      ozer: true,
      bloom: false,
      hubspot: 'partial',
      monday: false,
      zoho: 'partial',
      pipedrive: 'partial',
      honeybook: false,
    },
  },
  {
    id: 'meeting-assistant',
    feature: 'Meetings → tasks',
    hint: 'Task extraction from recorded meetings on Mac',
    preview: true,
    values: {
      ozer: true,
      bloom: false,
      hubspot: false,
      monday: false,
      zoho: false,
      pipedrive: false,
      honeybook: false,
    },
  },
  {
    id: 'portal',
    feature: 'Client portal & retainers',
    hint: 'Clients manage requests and retainers in one portal',
    preview: true,
    values: {
      ozer: true,
      bloom: 'partial',
      hubspot: 'partial',
      monday: false,
      zoho: 'partial',
      pipedrive: false,
      honeybook: 'partial',
    },
  },
  {
    id: 'invoicing',
    feature: 'Invoicing & payments',
    preview: true,
    values: {
      ozer: true,
      bloom: true,
      hubspot: true,
      monday: false,
      zoho: true,
      pipedrive: 'partial',
      honeybook: true,
    },
  },
  {
    id: 'pipeline',
    feature: 'Pipeline & leads',
    preview: true,
    values: {
      ozer: true,
      bloom: true,
      hubspot: true,
      monday: true,
      zoho: true,
      pipedrive: true,
      honeybook: true,
    },
  },
  {
    id: 'mac-activity',
    feature: 'Mac app & activity tracking',
    preview: true,
    values: {
      ozer: true,
      bloom: false,
      hubspot: false,
      monday: false,
      zoho: false,
      pipedrive: false,
      honeybook: false,
    },
  },
  {
    id: 'scheduling',
    feature: 'Scheduling & self-booking',
    values: {
      ozer: true,
      bloom: true,
      hubspot: true,
      monday: false,
      zoho: true,
      pipedrive: 'partial',
      honeybook: true,
    },
  },
  {
    id: 'proposals',
    feature: 'Proposals & contracts',
    values: {
      ozer: true,
      bloom: true,
      hubspot: 'partial',
      monday: false,
      zoho: true,
      pipedrive: true,
      honeybook: true,
    },
  },
  {
    id: 'planner',
    feature: 'One planner for work & life',
    values: {
      ozer: true,
      bloom: false,
      hubspot: false,
      monday: 'partial',
      zoho: false,
      pipedrive: false,
      honeybook: false,
    },
  },
  {
    id: 'personal',
    feature: 'Personal & family workspaces',
    values: {
      ozer: true,
      bloom: false,
      hubspot: false,
      monday: false,
      zoho: false,
      pipedrive: false,
      honeybook: false,
    },
  },
  {
    id: 'flat-pricing',
    feature: 'Flat team price (no per-seat maths)',
    values: {
      ozer: true,
      bloom: 'partial',
      hubspot: false,
      monday: false,
      zoho: false,
      pipedrive: false,
      honeybook: false,
    },
  },
  {
    id: 'eu-data',
    feature: 'EU data residency',
    values: {
      ozer: true,
      bloom: false,
      hubspot: 'partial',
      monday: 'partial',
      zoho: 'partial',
      pipedrive: 'partial',
      honeybook: false,
    },
  },
];

export const COMPETITOR_MATRIX_PREVIEW_ROWS = COMPETITOR_MATRIX_ROWS.filter(
  (row) => row.preview,
);

export const COMPETITOR_MATRIX_EXTRA_ROWS = COMPETITOR_MATRIX_ROWS.filter(
  (row) => !row.preview,
);
