import { normalizeFloodZone } from './parse';
import {
  type FloodFieldSnapshot,
  type FloodZone,
  OVERRIDABLE_FLOOD_FIELDS,
  type OverridableFloodField,
} from './types';

const EMPTY_SNAPSHOT: FloodFieldSnapshot = {
  floodZone: null,
  riversAndSea: null,
  surfaceWater: null,
  summary: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function snapshotFloodFields(
  input: Partial<FloodFieldSnapshot> | null | undefined,
): FloodFieldSnapshot {
  return {
    floodZone: normalizeFloodZone(input?.floodZone),
    riversAndSea: normalizeText(input?.riversAndSea),
    surfaceWater: normalizeText(input?.surfaceWater),
    summary: normalizeText(input?.summary),
  };
}

export function parsePulledFloodSnapshot(value: unknown): FloodFieldSnapshot {
  const record = asRecord(value);
  if (!record) return { ...EMPTY_SNAPSHOT };
  return snapshotFloodFields({
    floodZone: (record.floodZone ?? record.flood_zone) as FloodZone | null,
    riversAndSea: normalizeText(record.riversAndSea ?? record.rivers_and_sea),
    surfaceWater: normalizeText(record.surfaceWater ?? record.surface_water),
    summary: normalizeText(record.summary),
  });
}

export function parseOverriddenFloodFields(
  value: unknown,
): OverridableFloodField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OverridableFloodField =>
    OVERRIDABLE_FLOOD_FIELDS.includes(item as OverridableFloodField),
  );
}

export function overriddenFloodFields(
  pulled: Partial<FloodFieldSnapshot> | null | undefined,
  current: Partial<FloodFieldSnapshot> | null | undefined,
): OverridableFloodField[] {
  const left = snapshotFloodFields(pulled);
  const right = snapshotFloodFields(current);
  const changed: OverridableFloodField[] = [];
  for (const field of OVERRIDABLE_FLOOD_FIELDS) {
    if (normalizeText(left[field]) !== normalizeText(right[field])) {
      changed.push(field);
    }
  }
  return changed;
}

export function isFloodFieldOverridden(
  field: OverridableFloodField,
  overridden: readonly string[] | null | undefined,
): boolean {
  return parseOverriddenFloodFields(overridden).includes(field);
}
