import { describe, expect, it } from 'vitest';

import {
  defaultCommercialPipelineStageConfig,
  resolveCommercialPipelineBoardStages,
  resolveCommercialPipelineStageConfig,
} from './pipeline-stage-config';

describe('pipeline-stage-config', () => {
  it('defaults match Kato stages with idle hidden', () => {
    const defaults = defaultCommercialPipelineStageConfig();
    expect(defaults.map((stage) => stage.key)).toEqual([
      'shortlisted',
      'enquiry',
      'viewing',
      'negotiating',
      'under_offer',
      'signed',
      'idle',
      'discounted',
    ]);
    expect(defaults.find((stage) => stage.key === 'idle')?.hidden).toBe(true);
  });

  it('applies rename and hide overrides', () => {
    const resolved = resolveCommercialPipelineStageConfig([
      { key: 'enquiry', label: 'Inbound', hidden: false },
      { key: 'idle', label: 'Idle', hidden: false },
    ]);

    expect(resolved.find((stage) => stage.key === 'enquiry')?.label).toBe(
      'Inbound',
    );
    expect(resolved.find((stage) => stage.key === 'idle')?.hidden).toBe(false);
    expect(resolved).toHaveLength(8);
  });

  it('keeps hidden columns when deals remain', () => {
    const board = resolveCommercialPipelineBoardStages({
      stored: defaultCommercialPipelineStageConfig().map((stage) =>
        stage.key === 'idle'
          ? stage
          : { ...stage, hidden: stage.key === 'viewing' ? true : stage.hidden },
      ),
      dealStages: ['viewing'],
    });

    expect(board.some((stage) => stage.key === 'viewing')).toBe(true);
    expect(board.find((stage) => stage.key === 'viewing')?.forceVisible).toBe(
      true,
    );
    expect(board.some((stage) => stage.key === 'idle')).toBe(false);
  });
});
