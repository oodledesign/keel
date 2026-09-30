import { describe, expect, it } from 'vitest';

import {
  EMPTY_INSTRUCTION_PROPERTY,
  buildDisposalFromInstruction,
  formatInstructionAddress,
  instructionHasPropertyDetail,
} from './instruction-to-disposal';

const base = {
  ...EMPTY_INSTRUCTION_PROPERTY,
  title: 'Lyons Valuation',
  description: null,
  clientId: null,
};

describe('buildDisposalFromInstruction', () => {
  it('names the disposal after the address when there is one', () => {
    const out = buildDisposalFromInstruction({
      ...base,
      addressLine1: '  16 High Street ',
      town: 'Tunbridge Wells',
      postcode: 'TN1 1AA',
      latitude: 51.13,
      longitude: 0.26,
    });
    expect(out.name).toBe('16 High Street');
    expect(out.town).toBe('Tunbridge Wells');
    expect(out.postcode).toBe('TN1 1AA');
    expect(out.latitude).toBe(51.13);
    expect(out.longitude).toBe(0.26);
  });

  it('falls back to the instruction title, then a placeholder', () => {
    expect(buildDisposalFromInstruction(base).name).toBe('Lyons Valuation');
    expect(buildDisposalFromInstruction({ ...base, title: '  ' }).name).toBe(
      'Untitled disposal',
    );
  });

  it('copies asking terms, size and type, never the fee', () => {
    const out = buildDisposalFromInstruction({
      ...base,
      disposalType: 'for_sale',
      propertyType: 'Retail',
      sizeSqft: 1200,
      askingRentPence: 2_500_000,
      askingPricePence: 40_000_000,
    });
    expect(out.disposalType).toBe('for_sale');
    expect(out.sector).toBe('Retail');
    expect(out.sizeMinSqft).toBe(1200);
    expect(out.sizeMaxSqft).toBe(1200);
    expect(out.askingRentPence).toBe(2_500_000);
    expect(out.askingPricePence).toBe(40_000_000);
  });

  it('defaults to to-let for an unknown type and ignores a zero size', () => {
    const out = buildDisposalFromInstruction({
      ...base,
      disposalType: 'nonsense',
      sizeSqft: 0,
    });
    expect(out.disposalType).toBe('to_let');
    expect(out.sizeMinSqft).toBeNull();
  });

  it('carries the client and the brief across', () => {
    const out = buildDisposalFromInstruction({
      ...base,
      clientId: '11111111-1111-4111-8111-111111111111',
      description: ' Ground floor retail ',
    });
    expect(out.instructingClientId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(out.notes).toBe('Ground floor retail');
  });
});

describe('instructionHasPropertyDetail', () => {
  it('is false for an empty instruction and true once anything useful is set', () => {
    expect(instructionHasPropertyDetail(EMPTY_INSTRUCTION_PROPERTY)).toBe(
      false,
    );
    expect(
      instructionHasPropertyDetail({
        ...EMPTY_INSTRUCTION_PROPERTY,
        postcode: 'TN1 1AA',
      }),
    ).toBe(true);
  });
});

describe('formatInstructionAddress', () => {
  it('joins the parts that exist', () => {
    expect(
      formatInstructionAddress({
        addressLine1: '16 High Street',
        town: 'Leeds',
        postcode: ' LS1 4AB ',
      }),
    ).toBe('16 High Street, Leeds, LS1 4AB');
  });

  it('returns null when there is no address', () => {
    expect(
      formatInstructionAddress({
        addressLine1: null,
        town: ' ',
        postcode: null,
      }),
    ).toBeNull();
  });
});
