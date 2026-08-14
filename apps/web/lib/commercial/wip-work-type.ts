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
