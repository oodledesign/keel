export const OVERRIDABLE_EPC_FIELDS = [
  'currentRating',
  'potentialRating',
  'lodgementDate',
  'floorArea',
  'fuelType',
  'recommendationsSummary',
] as const;

export type OverridableEpcField = (typeof OVERRIDABLE_EPC_FIELDS)[number];

export type EpcFieldSnapshot = {
  currentRating: string | null;
  potentialRating: string | null;
  lodgementDate: string | null;
  floorArea: number | null;
  fuelType: string | null;
  recommendationsSummary: string | null;
};

const EMPTY_SNAPSHOT: EpcFieldSnapshot = {
  currentRating: null,
  potentialRating: null,
  lodgementDate: null,
  floorArea: null,
  fuelType: null,
  recommendationsSummary: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function snapshotEpcFields(
  input: Partial<EpcFieldSnapshot> | null | undefined,
): EpcFieldSnapshot {
  return {
    currentRating: normalizeText(input?.currentRating),
    potentialRating: normalizeText(input?.potentialRating),
    lodgementDate: normalizeText(input?.lodgementDate),
    floorArea: normalizeFloorArea(input?.floorArea),
    fuelType: normalizeText(input?.fuelType),
    recommendationsSummary: normalizeText(input?.recommendationsSummary),
  };
}

export function parsePulledSnapshot(value: unknown): EpcFieldSnapshot {
  const record = asRecord(value);
  if (!record) return { ...EMPTY_SNAPSHOT };
  return snapshotEpcFields({
    currentRating: readText(record, ['currentRating', 'current_rating']),
    potentialRating: readText(record, ['potentialRating', 'potential_rating']),
    lodgementDate: readText(record, ['lodgementDate', 'lodgement_date']),
    floorArea: readFloorArea(record, ['floorArea', 'floor_area']),
    fuelType: readText(record, ['fuelType', 'fuel_type']),
    recommendationsSummary: readText(record, [
      'recommendationsSummary',
      'recommendations_summary',
    ]),
  });
}

export function parseOverriddenFields(value: unknown): OverridableEpcField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OverridableEpcField =>
    OVERRIDABLE_EPC_FIELDS.includes(item as OverridableEpcField),
  );
}

export function overriddenEpcFields(
  pulled: Partial<EpcFieldSnapshot> | null | undefined,
  current: Partial<EpcFieldSnapshot> | null | undefined,
): OverridableEpcField[] {
  const left = snapshotEpcFields(pulled);
  const right = snapshotEpcFields(current);
  const changed: OverridableEpcField[] = [];
  for (const field of OVERRIDABLE_EPC_FIELDS) {
    if (!fieldEquals(field, left[field], right[field])) {
      changed.push(field);
    }
  }
  return changed;
}

export function mergeEpcWithOverrides(
  pulled: Partial<EpcFieldSnapshot> | null | undefined,
  current: Partial<EpcFieldSnapshot> | null | undefined,
  overridden: readonly string[] | null | undefined,
): EpcFieldSnapshot {
  const nextPulled = snapshotEpcFields(pulled);
  const nextCurrent = snapshotEpcFields(current);
  const keep = new Set(parseOverriddenFields(overridden));
  return {
    currentRating: keep.has('currentRating')
      ? nextCurrent.currentRating
      : nextPulled.currentRating,
    potentialRating: keep.has('potentialRating')
      ? nextCurrent.potentialRating
      : nextPulled.potentialRating,
    lodgementDate: keep.has('lodgementDate')
      ? nextCurrent.lodgementDate
      : nextPulled.lodgementDate,
    floorArea: keep.has('floorArea')
      ? nextCurrent.floorArea
      : nextPulled.floorArea,
    fuelType: keep.has('fuelType') ? nextCurrent.fuelType : nextPulled.fuelType,
    recommendationsSummary: keep.has('recommendationsSummary')
      ? nextCurrent.recommendationsSummary
      : nextPulled.recommendationsSummary,
  };
}

export function isEpcFieldOverridden(
  field: OverridableEpcField,
  overridden: readonly string[] | null | undefined,
): boolean {
  return parseOverriddenFields(overridden).includes(field);
}

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeFloorArea(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fieldEquals(
  field: OverridableEpcField,
  left: unknown,
  right: unknown,
): boolean {
  if (field === 'floorArea') {
    return normalizeFloorArea(left) === normalizeFloorArea(right);
  }
  return normalizeText(left) === normalizeText(right);
}

function readText(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return normalizeText(value);
    }
  }
  return null;
}

function readFloorArea(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const parsed = normalizeFloorArea(record[key]);
    if (parsed != null) return parsed;
  }
  return null;
}
