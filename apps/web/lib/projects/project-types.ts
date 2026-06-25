export const PROJECT_TYPES = ['delivery', 'campaign'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export type ProjectTypeMeta = {
  type: ProjectType;
  label: string;
  shortLabel: string;
  description: string;
  examples: string[];
  icon: 'delivery' | 'campaign';
};

export const PROJECT_TYPE_META: Record<ProjectType, ProjectTypeMeta> = {
  delivery: {
    type: 'delivery',
    label: 'Delivery project',
    shortLabel: 'Delivery',
    description:
      'One client, phased delivery with tasks, timeline, and team assignments.',
    examples: [
      'ChurchWorks website build',
      'Brand refresh with discovery → design → launch',
      'Monthly retainer with milestones',
    ],
    icon: 'delivery',
  },
  campaign: {
    type: 'campaign',
    label: 'Campaign tracker',
    shortLabel: 'Campaign',
    description:
      'Many clients in one spreadsheet-style tracker with custom columns and statuses.',
    examples: [
      'Website revamp outreach to 20 churches',
      'Q3 proposal follow-up pipeline',
      'Partner onboarding checklist across accounts',
    ],
    icon: 'campaign',
  },
};

export const DELIVERY_PROJECT_TYPE = 'delivery' as const;
export const CAMPAIGN_PROJECT_TYPE = 'campaign' as const;

/** Delivery rows live in public.projects with project_type = delivery (formerly jobs). */
export function deliveryProjectTitle(row: {
  title?: string | null;
  name?: string | null;
}): string {
  return row.title?.trim() || row.name?.trim() || 'Untitled project';
}
