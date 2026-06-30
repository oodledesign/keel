import type { PersonCircleTier } from './schema/people.schema';

export const CIRCLE_TIER_OPTIONS: Array<{
  value: PersonCircleTier;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'core',
    label: 'Core circle',
    shortLabel: 'Core',
    description: 'Partner, children, parents — your innermost circle.',
  },
  {
    value: 'close',
    label: 'Close',
    shortLabel: 'Close',
    description: 'Close friends and family you stay in regular touch with.',
  },
  {
    value: 'friends',
    label: 'Friends',
    shortLabel: 'Friends',
    description: 'Good friends and your wider social circle.',
  },
  {
    value: 'community',
    label: 'Community',
    shortLabel: 'Community',
    description: 'Acquaintances, neighbours, and wider network.',
  },
];

/** Innermost first — for grouped list sections. */
export const CIRCLE_TIER_ORDER: PersonCircleTier[] = [
  'core',
  'close',
  'friends',
  'community',
];

export function getCircleTierMeta(tier: PersonCircleTier) {
  return CIRCLE_TIER_OPTIONS.find((option) => option.value === tier)!;
}

export function circleTierBadgeClass(tier: PersonCircleTier): string {
  switch (tier) {
    case 'core':
      return 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)] ring-[var(--ozer-accent)]/25';
    case 'close':
      return 'bg-[#2563EB]/15 text-blue-200 ring-[#2563EB]/25';
    case 'friends':
      return 'bg-violet-500/15 text-violet-200 ring-violet-500/25';
    case 'community':
      return 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] ring-white/10';
    default:
      return 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] ring-white/10';
  }
}
