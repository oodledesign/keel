import { ozerColors, ozerStatusColors } from '~/lib/ozer/design-tokens';

export const PROJECT_STATUS_CATEGORIES = [
  'open',
  'completed',
  'cancelled',
] as const;

export type ProjectStatusCategory = (typeof PROJECT_STATUS_CATEGORIES)[number];

export type ProjectStatus = {
  id: string;
  accountId: string;
  slug: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  category: ProjectStatusCategory;
};

export type ProjectStatusSeed = {
  slug: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  category: ProjectStatusCategory;
};

export const DEFAULT_PROJECT_STATUS_SEEDS: readonly ProjectStatusSeed[] = [
  {
    slug: 'pending',
    label: 'Pending',
    color: ozerStatusColors.pending,
    sortOrder: 0,
    isDefault: true,
    category: 'open',
  },
  {
    slug: 'in_progress',
    label: 'In progress',
    color: ozerStatusColors.inProgress,
    sortOrder: 1,
    isDefault: false,
    category: 'open',
  },
  {
    slug: 'on_hold',
    label: 'On hold',
    color: ozerStatusColors.onHold,
    sortOrder: 2,
    isDefault: false,
    category: 'open',
  },
  {
    slug: 'completed',
    label: 'Completed',
    color: ozerStatusColors.completed,
    sortOrder: 3,
    isDefault: false,
    category: 'completed',
  },
  {
    slug: 'cancelled',
    label: 'Cancelled',
    color: ozerStatusColors.cancelled,
    sortOrder: 4,
    isDefault: false,
    category: 'cancelled',
  },
] as const;

export const DEFAULT_PROJECT_STATUS_SLUGS = DEFAULT_PROJECT_STATUS_SEEDS.map(
  (status) => status.slug,
);

export const PROJECT_STATUS_COLOR_PRESETS = [
  ozerStatusColors.pending,
  ozerStatusColors.inProgress,
  ozerStatusColors.onHold,
  ozerStatusColors.completed,
  ozerStatusColors.cancelled,
  ozerColors.info,
  ozerColors.accent,
  ozerColors.gold,
  '#059669',
  ozerColors.muted,
] as const;

const FALLBACK_STATUS: ProjectStatusSeed = DEFAULT_PROJECT_STATUS_SEEDS[0]!;

export function slugifyProjectStatusLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  if (!slug) return 'status';
  if (/^[a-z]/.test(slug)) return slug;
  return `s_${slug}`.slice(0, 48);
}

export function uniqueProjectStatusSlug(
  label: string,
  existingSlugs: Iterable<string>,
): string {
  const taken = new Set(existingSlugs);
  const base = slugifyProjectStatusLabel(label);
  if (!taken.has(base)) return base;

  for (let index = 2; index < 100; index += 1) {
    const suffix = `_${index}`;
    const next = `${base.slice(0, 48 - suffix.length)}${suffix}`;
    if (!taken.has(next)) return next;
  }

  return `${base.slice(0, 40)}_${Date.now().toString(36)}`.slice(0, 48);
}

export function contrastTextOnStatusColor(background: string): string {
  const hex = background.replace('#', '');
  if (hex.length !== 6) return ozerColors.white;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? ozerColors.plum : ozerColors.white;
}

export function findProjectStatus(
  slug: string | null | undefined,
  statuses: readonly ProjectStatus[],
): ProjectStatus | undefined {
  if (!slug) return statuses.find((status) => status.isDefault) ?? statuses[0];
  return statuses.find((status) => status.slug === slug);
}

export function projectStatusLabel(
  slug: string | null | undefined,
  statuses: readonly ProjectStatus[] = [],
): string {
  const match = findProjectStatus(slug, statuses);
  if (match) return match.label;

  const seed = DEFAULT_PROJECT_STATUS_SEEDS.find((item) => item.slug === slug);
  if (seed) return seed.label;

  if (!slug) return FALLBACK_STATUS.label;
  return slug.replace(/_/g, ' ');
}

export function projectStatusStyle(
  slug: string | null | undefined,
  statuses: readonly ProjectStatus[] = [],
): { label: string; bg: string; text: string } {
  const match = findProjectStatus(slug, statuses);
  if (match) {
    return {
      label: match.label,
      bg: match.color,
      text: contrastTextOnStatusColor(match.color),
    };
  }

  const seed = DEFAULT_PROJECT_STATUS_SEEDS.find((item) => item.slug === slug);
  const color = seed?.color ?? ozerColors.muted;
  return {
    label: seed?.label ?? projectStatusLabel(slug),
    bg: color,
    text: contrastTextOnStatusColor(color),
  };
}

export function defaultProjectStatusSlug(
  statuses: readonly ProjectStatus[],
): string {
  return (
    statuses.find((status) => status.isDefault)?.slug ??
    statuses.find((status) => status.category === 'open')?.slug ??
    statuses[0]?.slug ??
    FALLBACK_STATUS.slug
  );
}

export function closedProjectStatusSlugs(
  statuses: readonly ProjectStatus[],
): string[] {
  const closed = statuses
    .filter((status) => status.category !== 'open')
    .map((status) => status.slug);

  if (closed.length > 0) return closed;
  return ['completed', 'cancelled'];
}

export function openProjectStatusSlugs(
  statuses: readonly ProjectStatus[],
): string[] {
  const open = statuses
    .filter((status) => status.category === 'open')
    .map((status) => status.slug);

  if (open.length > 0) return open;
  return DEFAULT_PROJECT_STATUS_SEEDS.filter(
    (status) => status.category === 'open',
  ).map((status) => status.slug);
}

export type ProjectGroupId = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export function getProjectGroupId(
  status: string,
  statuses: readonly ProjectStatus[] = [],
): ProjectGroupId {
  const match = findProjectStatus(status, statuses);
  if (match) {
    if (match.category === 'completed') return 'completed';
    if (match.category === 'cancelled') return 'cancelled';
    if (match.slug === 'pending') return 'upcoming';
    return 'ongoing';
  }

  if (status === 'pending') return 'upcoming';
  if (status === 'in_progress' || status === 'on_hold') return 'ongoing';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'ongoing';
}

export function isClosedProjectStatus(
  status: string,
  statuses: readonly ProjectStatus[] = [],
): boolean {
  const group = getProjectGroupId(status, statuses);
  return group === 'completed' || group === 'cancelled';
}

export function fallbackProjectStatuses(accountId = ''): ProjectStatus[] {
  return DEFAULT_PROJECT_STATUS_SEEDS.map((seed) => ({
    id: seed.slug,
    accountId,
    slug: seed.slug,
    label: seed.label,
    color: seed.color,
    sortOrder: seed.sortOrder,
    isDefault: seed.isDefault,
    category: seed.category,
  }));
}
