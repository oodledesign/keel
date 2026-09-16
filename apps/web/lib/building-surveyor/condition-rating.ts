export const CONDITION_RATINGS = ['1', '2', '3', 'NA', 'NI'] as const;

export type ConditionRating = (typeof CONDITION_RATINGS)[number];

export const CONDITION_RATING_LABELS: Record<ConditionRating, string> = {
  '1': 'Condition rating 1',
  '2': 'Condition rating 2',
  '3': 'Condition rating 3',
  NA: 'Not applicable',
  NI: 'Not inspected',
};

export const CONDITION_RATING_COLORS: Record<ConditionRating, string> = {
  '1': '#2E7D32',
  '2': '#EF6C00',
  '3': '#C62828',
  NA: '#6B7280',
  NI: '#6B7280',
};

export function isConditionRating(
  value: string | null | undefined,
): value is ConditionRating {
  return Boolean(value && CONDITION_RATINGS.includes(value as ConditionRating));
}

export function normalizeConditionRating(
  value: string | null | undefined,
): ConditionRating | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
    return trimmed;
  }
  if (trimmed === 'NA' || trimmed === 'N/A' || trimmed === 'NOT APPLICABLE') {
    return 'NA';
  }
  if (trimmed === 'NI' || trimmed === 'N/I' || trimmed === 'NOT INSPECTED') {
    return 'NI';
  }
  return null;
}
