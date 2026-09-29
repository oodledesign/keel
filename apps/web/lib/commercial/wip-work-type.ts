/** Commercial instruction work type (disposal vs professional vs management). */

export const WIP_WORK_TYPES = ['agency', 'professional', 'management'] as const;

export type WipWorkType = (typeof WIP_WORK_TYPES)[number];

export const WIP_WORK_TYPE_LABELS: Record<WipWorkType, string> = {
  agency: 'Agency',
  professional: 'Professional',
  management: 'Management',
};

export function normalizeWipWorkType(
  value: string | null | undefined,
): WipWorkType | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key === 'agency' || key === 'professional' || key === 'management') {
    return key;
  }
  if (key === 'mi' || key === 'professional_mi') return 'professional';
  return null;
}

/**
 * Faint row/card wash mixed into the panel colour so it stays readable
 * in light and dark mode. Professional is the light blue Abbey asked for.
 * Kept light on purpose: the work-type pill carries the stronger colour.
 */
export const WIP_WORK_TYPE_SURFACE: Record<WipWorkType, string> = {
  professional: 'color-mix(in srgb, #38bdf8 10%, var(--workspace-shell-panel))',
  agency: 'color-mix(in srgb, #f59e0b 6%, var(--workspace-shell-panel))',
  management: 'color-mix(in srgb, #34d399 7%, var(--workspace-shell-panel))',
};

export function wipWorkTypeSurface(
  value: string | null | undefined,
): string | undefined {
  const key = normalizeWipWorkType(value);
  return key ? WIP_WORK_TYPE_SURFACE[key] : undefined;
}
