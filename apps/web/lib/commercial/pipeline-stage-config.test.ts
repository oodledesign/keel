import { describe, expect, it } from 'vitest';

import {
  defaultCommercialPipelineStageConfig,
  normalizeCommercialPipelineStage,
  resolveCommercialPipelineBoardStages,
  resolveCommercialPipelineStageConfig,
} from './pipeline-stage-config';

describe('pipeline-stage-config', () => {
  it('defaults match WIP Instruction stages', () => {
    const defaults = defaultCommercialPipelineStageConfig();
    expect(defaults.map((stage) => stage.key)).toEqual([
      'billed',
      'completed',
      'under_offer',
      'negotiating',
      'current',
      'potential',
      'managed',
      'fallen_through',
    ]);
  });

  it('normalizes legacy Kato keys into WIP stages', () => {
    expect(normalizeCommercialPipelineStage('enquiry')).toBe('potential');
    expect(normalizeCommercialPipelineStage('viewing')).toBe('current');
    expect(normalizeCommercialPipelineStage('signed')).toBe('completed');
    expect(normalizeCommercialPipelineStage('completed_exchanged')).toBe(
      'completed_exchanged',
    );
    expect(normalizeCommercialPipelineStage('under_offer_negotiating')).toBe(
      'under_offer_negotiating',
    );
    expect(normalizeCommercialPipelineStage('discounted')).toBe(
      'fallen_through',
    );
  });

  it('applies rename and hide overrides', () => {
    const resolved = resolveCommercialPipelineStageConfig([
      { key: 'potential', label: 'Pitching', hidden: false },
      { key: 'fallen_through', label: 'Lost', hidden: true },
    ]);

    expect(resolved.find((stage) => stage.key === 'potential')?.label).toBe(
      'Pitching',
    );
    expect(
      resolved.find((stage) => stage.key === 'fallen_through')?.hidden,
    ).toBe(true);
    expect(resolved).toHaveLength(8);
  });

  it('keeps hidden columns when deals remain', () => {
    const board = resolveCommercialPipelineBoardStages({
      stored: defaultCommercialPipelineStageConfig().map((stage) =>
        stage.key === 'fallen_through' ? { ...stage, hidden: true } : stage,
      ),
      dealStages: ['fallen_through'],
    });

    expect(board.some((stage) => stage.key === 'fallen_through')).toBe(true);
    expect(
      board.find((stage) => stage.key === 'fallen_through')?.forceVisible,
    ).toBe(true);
  });

  it('shows combined stages above fallen through until they are moved', () => {
    const board = resolveCommercialPipelineBoardStages({
      dealStages: ['completed_exchanged', 'under_offer_negotiating'],
    });
    const keys = board.map((stage) => stage.key);

    expect(keys.indexOf('completed_exchanged')).toBeGreaterThan(-1);
    expect(keys.indexOf('under_offer_negotiating')).toBeGreaterThan(-1);
    expect(keys.indexOf('completed_exchanged')).toBeLessThan(
      keys.indexOf('fallen_through'),
    );
    expect(keys.indexOf('under_offer_negotiating')).toBeLessThan(
      keys.indexOf('fallen_through'),
    );
    expect(
      board.find((stage) => stage.key === 'completed_exchanged')?.label,
    ).toBe('Completed / exchanged');
    expect(
      board.find((stage) => stage.key === 'under_offer_negotiating')?.label,
    ).toBe('Under offer / negotiating');
  });
});
