/**
 * Ladder / board stage colour accents for commercial instructions.
 */

import type { CommercialPipelineStage } from './commercial-constants';

export const WIP_STAGE_COLOURS: Record<
  CommercialPipelineStage,
  { bar: string; tint: string; label: string }
> = {
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

export function wipStageColour(stageKey: string) {
  return (
    WIP_STAGE_COLOURS[stageKey as CommercialPipelineStage] ?? {
      bar: '#8A7A82',
      tint: 'rgba(138, 122, 130, 0.1)',
      label: '#5C4F55',
    }
  );
}
