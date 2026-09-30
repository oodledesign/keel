import { describe, expect, it } from 'vitest';

import type { AddressSuggestion } from './address-suggest.types';
import {
  EMPTY_PROPERTY_DRAFT,
  applyAddressToDraft,
  draftFromInstruction,
  draftToInstructionInput,
} from './instruction-property-draft';
import { EMPTY_INSTRUCTION_PROPERTY } from './instruction-to-disposal';

const suggestion: AddressSuggestion = {
  id: 'x',
  label: '16 High Street, Tunbridge Wells, TN1 1AA',
  nameHint: null,
  addressLine1: '16 High Street',
  addressLine2: null,
  town: 'Tunbridge Wells',
  county: 'Kent',
  postcode: 'TN1 1AA',
  country: 'GB',
  latitude: 51.13,
  longitude: 0.26,
};

describe('instruction property draft', () => {
  it('fills address and map pin from an autocomplete result', () => {
    const draft = applyAddressToDraft(EMPTY_PROPERTY_DRAFT, suggestion);
    expect(draft.addressLine1).toBe('16 High Street');
    expect(draft.county).toBe('Kent');
    expect(draft.latitude).toBe('51.13');
  });

  it('keeps what was typed elsewhere when an address is picked', () => {
    const draft = applyAddressToDraft(
      { ...EMPTY_PROPERTY_DRAFT, sizeSqft: '900', disposalType: 'for_sale' },
      suggestion,
    );
    expect(draft.sizeSqft).toBe('900');
    expect(draft.disposalType).toBe('for_sale');
  });

  it('converts pounds to pence and back', () => {
    const input = draftToInstructionInput({
      ...EMPTY_PROPERTY_DRAFT,
      askingRent: '£25,000',
      askingPrice: '400000.50',
      sizeSqft: '1,200',
    });
    expect(input.askingRentPence).toBe(2_500_000);
    expect(input.askingPricePence).toBe(40_000_050);
    expect(input.sizeSqft).toBe(1200);

    const back = draftFromInstruction({
      ...EMPTY_INSTRUCTION_PROPERTY,
      askingRentPence: 2_500_000,
    });
    expect(back.askingRent).toBe('25000');
  });

  it('sends null for cleared and invalid fields so they are actually cleared', () => {
    const input = draftToInstructionInput({
      ...EMPTY_PROPERTY_DRAFT,
      addressLine1: '   ',
      askingRent: 'lots',
      sizeSqft: '-5',
    });
    expect(input.addressLine1).toBeNull();
    expect(input.askingRentPence).toBeNull();
    expect(input.sizeSqft).toBeNull();
  });
});
