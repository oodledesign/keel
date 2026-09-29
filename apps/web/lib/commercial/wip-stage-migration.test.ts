import { describe, expect, it } from 'vitest';

import { normalizeCommercialPipelineStage } from './pipeline-stage-config';
import {
  commercialInstructionHasBilledSignal,
  remapStoredCommercialInstructionStage,
} from './wip-stage-migration';

describe('commercial instruction stage migration', () => {
  it('leaves combined stages for the team to move, even when notes say billed', () => {
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'completed_exchanged',
        notes: 'Exchanged and completed',
      }),
    ).toBe('completed_exchanged');

    expect(
      remapStoredCommercialInstructionStage({
        stage: 'completed_exchanged',
        notes: '18.06 DT billed',
      }),
    ).toBe('completed_exchanged');

    expect(
      remapStoredCommercialInstructionStage({
        stage: 'completed_exchanged',
        name: 'Agency billed — Poundland',
      }),
    ).toBe('completed_exchanged');
  });

  it('does not treat billing-adjacent words as a billed signal', () => {
    expect(
      commercialInstructionHasBilledSignal({
        notes: 'unbilled fee still to raise',
      }),
    ).toBe(false);
    expect(
      commercialInstructionHasBilledSignal({
        hotsNotes: 'Fee billed.',
      }),
    ).toBe(true);
  });

  it('leaves the combined under-offer column for the team to split', () => {
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'under_offer_negotiating',
      }),
    ).toBe('under_offer_negotiating');
  });

  it('leaves management instructions in current or potential', () => {
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'current',
        workType: 'management',
      }),
    ).toBe('current');
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'potential',
        workType: 'management',
      }),
    ).toBe('potential');
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'under_offer',
        workType: 'management',
      }),
    ).toBe('under_offer');
  });

  it('keeps older Kato aliases, and leaves combined keys alone', () => {
    expect(normalizeCommercialPipelineStage('signed')).toBe('completed');
    expect(normalizeCommercialPipelineStage('completed_exchanged')).toBe(
      'completed_exchanged',
    );
    expect(normalizeCommercialPipelineStage('under_offer_negotiating')).toBe(
      'under_offer_negotiating',
    );
    expect(normalizeCommercialPipelineStage('offer')).toBe('under_offer');
    expect(normalizeCommercialPipelineStage('hots')).toBe('under_offer');
    expect(normalizeCommercialPipelineStage('negotiating')).toBe('negotiating');
    expect(normalizeCommercialPipelineStage('under_offer')).toBe('under_offer');
    expect(normalizeCommercialPipelineStage('completed')).toBe('completed');
    expect(normalizeCommercialPipelineStage('billed')).toBe('billed');
    expect(normalizeCommercialPipelineStage('fell_through')).toBe(
      'fallen_through',
    );
  });
});
