import { describe, expect, it } from 'vitest';

import {
  defaultCommercialPipelineStageConfig,
  resolveCommercialPipelineBoardStages,
  resolveCommercialPipelineStageConfig,
  normalizeCommercialPipelineStage,
} from './pipeline-stage-config';

describe('pipeline-stage-config', () => {
  it('defaults match WIP Instruction stages', () => {
    const defaults = defaultCommercialPipelineStageConfig();
    expect(defaults.map((stage) => stage.key)).toEqual([
      'potential',
      'current',
      'under_offer_negotiating',
      'completed_exchanged',
      'fallen_through',
    ]);
  });

  it('normalizes legacy Kato keys into WIP stages', () => {
    expect(normalizeCommercialPipelineStage('enquiry')).toBe('potential');
    expect(normalizeCommercialPipelineStage('viewing')).toBe('current');
    expect(normalizeCommercialPipelineStage('signed')).toBe(
      'completed_exchanged',
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
    expect(resolved).toHaveLength(5);
  });

  it('keeps hidden columns when deals remain', () => {
    const board = resolveCommercialPipelineBoardStages({
      stored: defaultCommercialPipelineStageConfig().map((stage) =>
        stage.key === 'fallen_through'
          ? { ...stage, hidden: true }
          : stage,
      ),
      dealStages: ['fallen_through'],
    });

    expect(board.some((stage) => stage.key === 'fallen_through')).toBe(true);
    expect(
      board.find((stage) => stage.key === 'fallen_through')?.forceVisible,
    ).toBe(true);
  });
});
