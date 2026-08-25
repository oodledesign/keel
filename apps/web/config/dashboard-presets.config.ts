import { z } from 'zod';

export const DASHBOARD_CARD_IDS = [
  'finance',
  'pipeline',
  'overview_tabs',
  'needs_reply',
  'support_tickets',
  'email_tasks',
  'upcoming_tasks',
  'recent_notes',
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];

export const DASHBOARD_PRESET_IDS = [
  'overview',
  'pipeline',
  'tasks',
  'finance',
] as const;

export type DashboardPresetId = (typeof DASHBOARD_PRESET_IDS)[number];

export type DashboardCardSize = 'sm' | 'md' | 'lg';

export type DashboardOverviewTab = 'projects' | 'team' | 'invoices';

const DashboardCardIdSchema = z.enum(DASHBOARD_CARD_IDS);
const DashboardPresetIdSchema = z.enum(DASHBOARD_PRESET_IDS);

const DashboardPresetSchema = z.object({
  id: DashboardPresetIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  cardOrder: z.array(DashboardCardIdSchema).min(1),
  cardSizes: z
    .record(DashboardCardIdSchema, z.enum(['sm', 'md', 'lg']))
    .optional(),
  defaultOverviewTab: z.enum(['projects', 'team', 'invoices']).optional(),
});

export type DashboardPreset = z.infer<typeof DashboardPresetSchema>;

const presetsRaw = [
  {
    id: 'overview' as const,
    label: 'Overview',
    description:
      'Finance and tasks side by side, then replies and pipeline with projects below.',
    cardOrder: [
      'finance',
      'upcoming_tasks',
      'needs_reply',
      'support_tickets',
      'pipeline',
      'overview_tabs',
      'recent_notes',
    ] as const satisfies DashboardCardId[],
    cardSizes: {
      finance: 'md' as const,
      upcoming_tasks: 'md' as const,
      recent_notes: 'md' as const,
    },
    defaultOverviewTab: 'projects' as const,
  },
  {
    id: 'pipeline' as const,
    label: 'Pipeline-first',
    description:
      'Deals board summary at the top, with finance and activity below.',
    cardOrder: [
      'pipeline',
      'needs_reply',
      'upcoming_tasks',
      'support_tickets',
      'finance',
      'overview_tabs',
      'recent_notes',
    ] as const satisfies DashboardCardId[],
    cardSizes: {
      pipeline: 'lg' as const,
      finance: 'md' as const,
      upcoming_tasks: 'md' as const,
    },
    defaultOverviewTab: 'projects' as const,
  },
  {
    id: 'tasks' as const,
    label: 'Tasks-first',
    description:
      'Open tasks, email follow-ups, and support tickets before pipeline and stats.',
    cardOrder: [
      'upcoming_tasks',
      'needs_reply',
      'support_tickets',
      'pipeline',
      'finance',
      'overview_tabs',
      'recent_notes',
    ] as const satisfies DashboardCardId[],
    cardSizes: {
      upcoming_tasks: 'lg' as const,
    },
    defaultOverviewTab: 'projects' as const,
  },
  {
    id: 'finance' as const,
    label: 'Finance-first',
    description:
      'Revenue and invoicing up front, with pipeline and day-to-day work below.',
    cardOrder: [
      'finance',
      'needs_reply',
      'upcoming_tasks',
      'support_tickets',
      'pipeline',
      'overview_tabs',
      'recent_notes',
    ] as const satisfies DashboardCardId[],
    cardSizes: {
      finance: 'lg' as const,
      overview_tabs: 'lg' as const,
    },
    defaultOverviewTab: 'invoices' as const,
  },
];

export const DASHBOARD_PRESETS: DashboardPreset[] = presetsRaw.map((preset) =>
  DashboardPresetSchema.parse({
    ...preset,
    cardOrder: [...preset.cardOrder],
  }),
);

export const DEFAULT_DASHBOARD_PRESET_ID: DashboardPresetId = 'overview';

/** Stable schematic colour per card — five brand tokens only. */
export const DASHBOARD_CARD_THUMB_COLOURS: Record<DashboardCardId, string> = {
  finance: 'var(--ozer-orange-topaze)',
  pipeline: 'var(--ozer-lime-400)',
  overview_tabs: 'var(--ozer-cool-blue)',
  needs_reply: 'var(--ozer-sage-500)',
  support_tickets: 'var(--ozer-plum-900)',
  email_tasks: 'var(--ozer-sage-500)',
  upcoming_tasks: 'var(--ozer-lime-400)',
  recent_notes: 'var(--ozer-cool-blue)',
};

export function isDashboardPresetId(value: string): value is DashboardPresetId {
  return (DASHBOARD_PRESET_IDS as readonly string[]).includes(value);
}

export function getDashboardPreset(
  id: DashboardPresetId | null | undefined,
): DashboardPreset {
  const resolved =
    id && isDashboardPresetId(id) ? id : DEFAULT_DASHBOARD_PRESET_ID;
  return (
    DASHBOARD_PRESETS.find((preset) => preset.id === resolved) ??
    DASHBOARD_PRESETS[0]!
  );
}

export function resolveDashboardCardOrder(
  presetId: DashboardPresetId | null | undefined,
): DashboardCardId[] {
  return [...getDashboardPreset(presetId).cardOrder];
}
