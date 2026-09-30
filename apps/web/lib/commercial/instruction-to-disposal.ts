import type { CreateListingInput } from '~/home/[account]/listings/_lib/schema/listings.schema';

import { DISPOSAL_TYPES, type DisposalType } from './commercial-constants';

/** Property details captured on an instruction (all optional). */
export type InstructionPropertyFields = {
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  disposalType: string | null;
  propertyType: string | null;
  sizeSqft: number | null;
  askingRentPence: number | null;
  askingPricePence: number | null;
};

export const EMPTY_INSTRUCTION_PROPERTY: InstructionPropertyFields = {
  addressLine1: null,
  addressLine2: null,
  town: null,
  county: null,
  postcode: null,
  latitude: null,
  longitude: null,
  disposalType: null,
  propertyType: null,
  sizeSqft: null,
  askingRentPence: null,
  askingPricePence: null,
};

type InstructionForDisposal = InstructionPropertyFields & {
  /** Display title of the instruction, used when no address is set. */
  title: string;
  description: string | null;
  clientId: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeDisposalType(
  value: string | null | undefined,
): DisposalType | null {
  return (DISPOSAL_TYPES as readonly string[]).includes(value ?? '')
    ? (value as DisposalType)
    : null;
}

/** True when the instruction has enough property detail to seed a disposal. */
export function instructionHasPropertyDetail(
  fields: InstructionPropertyFields,
): boolean {
  return Boolean(
    clean(fields.addressLine1) ||
    clean(fields.postcode) ||
    fields.sizeSqft != null ||
    fields.askingRentPence != null ||
    fields.askingPricePence != null ||
    normalizeDisposalType(fields.disposalType),
  );
}

/**
 * Builds the draft disposal from an instruction so the team does not have to
 * retype what they already know. The instruction's `value` is the agent's fee,
 * so it is deliberately not copied to the asking rent or price.
 */
export function buildDisposalFromInstruction(
  instruction: InstructionForDisposal,
): Omit<CreateListingInput, 'accountId'> {
  const addressLine1 = clean(instruction.addressLine1);
  const size = instruction.sizeSqft;
  const hasSize = size != null && Number.isFinite(size) && size > 0;

  return {
    name: addressLine1 ?? (clean(instruction.title) || 'Untitled disposal'),
    status: 'draft',
    addressLine1,
    addressLine2: clean(instruction.addressLine2),
    town: clean(instruction.town),
    county: clean(instruction.county),
    postcode: clean(instruction.postcode),
    country: 'GB',
    latitude: instruction.latitude,
    longitude: instruction.longitude,
    disposalType: normalizeDisposalType(instruction.disposalType) ?? 'to_let',
    sector: clean(instruction.propertyType),
    sizeMinSqft: hasSize ? size : null,
    sizeMaxSqft: hasSize ? size : null,
    askingRentPence: instruction.askingRentPence,
    askingPricePence: instruction.askingPricePence,
    notes: clean(instruction.description),
    instructingClientId: instruction.clientId,
  };
}

/** One-line address for lists, e.g. "16 High Street, Leeds, LS1 4AB". */
export function formatInstructionAddress(
  property: Pick<
    InstructionPropertyFields,
    'addressLine1' | 'town' | 'postcode'
  >,
): string | null {
  const parts = [property.addressLine1, property.town, property.postcode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(', ') : null;
}
