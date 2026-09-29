/**
 * Ladder / board / sheet stage colour accents for commercial WIP.
 */
import {
  type CommercialPipelineStage,
  REQUIREMENT_STATUSES,
  type RequirementStatus,
} from './commercial-constants';
import { normalizeCommercialPipelineStage } from './pipeline-stage-config';

type StageColour = { bar: string; tint: string; label: string };

const FALLBACK_STAGE_COLOUR: StageColour = {
  bar: '#8A7A82',
  tint: 'rgba(138, 122, 130, 0.1)',
  label: '#5C4F55',
};

export const WIP_STAGE_COLOURS: Record<CommercialPipelineStage, StageColour> = {
  billed: {
    bar: '#27751E',
    tint: 'rgba(39, 117, 30, 0.14)',
    label: '#166534',
  },
  completed: {
    bar: '#0F766E',
    tint: 'rgba(15, 118, 110, 0.14)',
    label: '#115E59',
  },
  under_offer: {
    bar: '#D97706',
    tint: 'rgba(217, 119, 6, 0.14)',
    label: '#92400E',
  },
  negotiating: {
    bar: '#C2410C',
    tint: 'rgba(194, 65, 12, 0.12)',
    label: '#9A3412',
  },
  current: {
    bar: '#FF5C34',
    tint: 'rgba(255, 92, 52, 0.12)',
    label: '#C2410C',
  },
  potential: {
    bar: '#41606F',
    tint: 'rgba(65, 96, 111, 0.12)',
    label: '#41606F',
  },
  managed: {
    bar: '#3D5A80',
    tint: 'rgba(61, 90, 128, 0.14)',
    label: '#1E3A5F',
  },
  fallen_through: {
    bar: '#8A7A82',
    tint: 'rgba(138, 122, 130, 0.14)',
    label: '#5C4F55',
  },
};

/** Requirement stages — aligned with instruction palette by funnel position. */
export const REQUIREMENT_STAGE_COLOURS: Record<RequirementStatus, StageColour> =
  {
    new: WIP_STAGE_COLOURS.potential,
    actively_searching: WIP_STAGE_COLOURS.current,
    under_offer_negotiating: WIP_STAGE_COLOURS.under_offer,
    fulfilled: WIP_STAGE_COLOURS.completed,
    withdrawn: WIP_STAGE_COLOURS.fallen_through,
  };

const REQUIREMENT_STAGE_SET = new Set<string>(REQUIREMENT_STATUSES);

export function wipStageColour(stageKey: string): StageColour {
  if (REQUIREMENT_STAGE_SET.has(stageKey)) {
    return REQUIREMENT_STAGE_COLOURS[stageKey as RequirementStatus];
  }

  const normalized = normalizeCommercialPipelineStage(stageKey);
  return (
    WIP_STAGE_COLOURS[normalized as CommercialPipelineStage] ??
    FALLBACK_STAGE_COLOUR
  );
}
