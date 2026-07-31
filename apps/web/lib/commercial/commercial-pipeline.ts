/**
 * Commercial Property deal pipeline stages.
 * Prefer importing from commercial-constants / pipeline-stage-config;
 * this module re-exports a labeled array for UI scaffolding.
 */
import {
  COMMERCIAL_PIPELINE_BOARD_STAGES,
  COMMERCIAL_PIPELINE_STAGE_LABELS,
  type CommercialPipelineStage,
} from './commercial-constants';

export const COMMERCIAL_PIPELINE_STAGES = COMMERCIAL_PIPELINE_BOARD_STAGES.map(
  (stage) => ({
    id: stage.key,
    label: stage.label,
  }),
) as ReadonlyArray<{ id: CommercialPipelineStage; label: string }>;

export type CommercialPipelineStageId = CommercialPipelineStage;

export function commercialPipelineStageLabel(id: string): string | undefined {
  return COMMERCIAL_PIPELINE_STAGE_LABELS[id as CommercialPipelineStage];
}

export {
  COMMERCIAL_PIPELINE_BOARD_STAGES,
  COMMERCIAL_PIPELINE_STAGE_LABELS,
  COMMERCIAL_PIPELINE_LOST_STAGE,
  COMMERCIAL_PIPELINE_WON_STAGE,
} from './commercial-constants';

export {
  defaultCommercialPipelineStageConfig,
  resolveCommercialPipelineBoardStages,
  resolveCommercialPipelineStageConfig,
  type PipelineStageBoardItem,
  type PipelineStageConfigItem,
} from './pipeline-stage-config';
