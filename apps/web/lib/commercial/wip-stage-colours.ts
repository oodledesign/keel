/**
 * Ladder / board / sheet stage colour accents for commercial WIP.
 */
import type {
  CommercialPipelineStage,
  RequirementStatus,
} from './commercial-constants';

type StageColour = { bar: string; tint: string; label: string };

const FALLBACK_STAGE_COLOUR: StageColour = {
  bar: '#8A7A82',
  tint: 'rgba(138, 122, 130, 0.1)',
  label: '#5C4F55',
};

export const WIP_STAGE_COLOURS: Record<CommercialPipelineStage, StageColour> = {
  potential: {
    bar: '#41606F',
    tint: 'rgba(65, 96, 111, 0.12)',
    label: '#41606F',
  },
  current: {
    bar: '#FF5C34',
    tint: 'rgba(255, 92, 52, 0.12)',
    label: '#C2410C',
  },
  under_offer_negotiating: {
    bar: '#D97706',
    tint: 'rgba(217, 119, 6, 0.14)',
    label: '#92400E',
  },
  completed_exchanged: {
    bar: '#27751E',
    tint: 'rgba(39, 117, 30, 0.12)',
    label: '#166534',
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
    under_offer_negotiating: WIP_STAGE_COLOURS.under_offer_negotiating,
    fulfilled: WIP_STAGE_COLOURS.completed_exchanged,
    withdrawn: WIP_STAGE_COLOURS.fallen_through,
  };

export function wipStageColour(stageKey: string): StageColour {
  return (
    WIP_STAGE_COLOURS[stageKey as CommercialPipelineStage] ??
    REQUIREMENT_STAGE_COLOURS[stageKey as RequirementStatus] ??
    FALLBACK_STAGE_COLOUR
  );
}
