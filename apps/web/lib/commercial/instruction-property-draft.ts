import type { AddressSuggestion } from './address-suggest.types';
import type { InstructionPropertyFields } from './instruction-to-disposal';

/** Form-state (strings) for an instruction's property details. */
export type InstructionPropertyDraft = {
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  latitude: string;
  longitude: string;
  disposalType: string;
  propertyType: string;
  sizeSqft: string;
  /** Pounds, as typed. */
  askingRent: string;
  /** Pounds, as typed. */
  askingPrice: string;
};

export const EMPTY_PROPERTY_DRAFT: InstructionPropertyDraft = {
  addressLine1: '',
  addressLine2: '',
  town: '',
  county: '',
  postcode: '',
  latitude: '',
  longitude: '',
  disposalType: '',
  propertyType: '',
  sizeSqft: '',
  askingRent: '',
  askingPrice: '',
};

function penceToPounds(pence: number | null) {
  return pence == null ? '' : String(pence / 100);
}

export function draftFromInstruction(
  fields: InstructionPropertyFields | null | undefined,
): InstructionPropertyDraft {
  if (!fields) return { ...EMPTY_PROPERTY_DRAFT };
  return {
    addressLine1: fields.addressLine1 ?? '',
    addressLine2: fields.addressLine2 ?? '',
    town: fields.town ?? '',
    county: fields.county ?? '',
    postcode: fields.postcode ?? '',
    latitude: fields.latitude != null ? String(fields.latitude) : '',
    longitude: fields.longitude != null ? String(fields.longitude) : '',
    disposalType: fields.disposalType ?? '',
    propertyType: fields.propertyType ?? '',
    sizeSqft: fields.sizeSqft != null ? String(fields.sizeSqft) : '',
    askingRent: penceToPounds(fields.askingRentPence),
    askingPrice: penceToPounds(fields.askingPricePence),
  };
}

/** Picking an autocomplete result fills the address and the map pin. */
export function applyAddressToDraft(
  draft: InstructionPropertyDraft,
  suggestion: AddressSuggestion,
): InstructionPropertyDraft {
  return {
    ...draft,
    addressLine1:
      suggestion.addressLine1?.trim() ||
      suggestion.nameHint?.trim() ||
      suggestion.label,
    addressLine2: suggestion.addressLine2 ?? '',
    town: suggestion.town ?? '',
    county: suggestion.county ?? '',
    postcode: suggestion.postcode ?? '',
    latitude: String(suggestion.latitude),
    longitude: String(suggestion.longitude),
  };
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string) {
  const cleaned = value.replace(/[£,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function poundsToPence(value: string) {
  const n = numberOrNull(value);
  return n == null ? null : Math.round(n * 100);
}

/**
 * Draft → values to save. Every key is included (empty → null) so clearing a
 * field in the form clears it in the database.
 */
export function draftToInstructionInput(draft: InstructionPropertyDraft) {
  return {
    addressLine1: textOrNull(draft.addressLine1),
    addressLine2: textOrNull(draft.addressLine2),
    town: textOrNull(draft.town),
    county: textOrNull(draft.county),
    postcode: textOrNull(draft.postcode),
    latitude: numberOrNull(draft.latitude),
    longitude: numberOrNull(draft.longitude),
    disposalType: textOrNull(draft.disposalType),
    propertyType: textOrNull(draft.propertyType),
    sizeSqft: numberOrNull(draft.sizeSqft),
    askingRentPence: poundsToPence(draft.askingRent),
    askingPricePence: poundsToPence(draft.askingPrice),
  };
}
