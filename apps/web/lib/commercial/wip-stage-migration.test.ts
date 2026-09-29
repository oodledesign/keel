import { describe, expect, it } from 'vitest';

import { normalizeCommercialPipelineStage } from './pipeline-stage-config';
import {
  commercialInstructionHasBilledSignal,
  remapStoredCommercialInstructionStage,
} from './wip-stage-migration';

describe('commercial instruction stage migration', () => {
  it('sends completed_exchanged to completed unless a billed word is present', () => {
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'completed_exchanged',
        notes: 'Exchanged and completed',
      }),
    ).toBe('completed');

    expect(
      remapStoredCommercialInstructionStage({
        stage: 'completed_exchanged',
        notes: '18.06 DT billed',
      }),
    ).toBe('billed');

    expect(
      remapStoredCommercialInstructionStage({
        stage: 'completed_exchanged',
        name: 'Agency billed — Poundland',
      }),
    ).toBe('billed');
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

  it('splits under offer / negotiating onto under offer', () => {
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'under_offer_negotiating',
      }),
    ).toBe('under_offer');
  });

  it('moves management instructions that are still current or potential onto managed', () => {
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'current',
        workType: 'management',
      }),
    ).toBe('managed');
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'potential',
        workType: 'management',
      }),
    ).toBe('managed');
    expect(
      remapStoredCommercialInstructionStage({
        stage: 'under_offer',
        workType: 'management',
      }),
    ).toBe('under_offer');
  });

  it('keeps legacy aliases pointing at the split ladder', () => {
    expect(normalizeCommercialPipelineStage('signed')).toBe('completed');
    expect(normalizeCommercialPipelineStage('completed_exchanged')).toBe(
      'completed',
    );
    expect(normalizeCommercialPipelineStage('under_offer_negotiating')).toBe(
      'under_offer',
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
