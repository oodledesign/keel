import { normalizeCommercialPipelineStage } from '~/lib/commercial/pipeline-stage-config';

/** Stages that roll into the Under offer running-total card. */
export const WIP_UNDER_OFFER_TOTAL_STAGES = [
  'under_offer',
  'negotiating',
] as const;

export type WipRunningTotals = {
  billed: number;
  underOffer: number;
  total: number;
};

type WipFeeRow = {
  stage: string;
  value?: number | null;
};

function feeValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Running fee totals for the commercial WIP instruction list.
 * Billed = Billed stage only. Under offer = Under offer + Negotiating.
 * Total = billed + under offer (completed and other stages stay off the cards).
 */
export function computeWipInstructionTotals(
  deals: readonly WipFeeRow[],
): WipRunningTotals {
  let billed = 0;
  let underOffer = 0;

  for (const deal of deals) {
    const stage = normalizeCommercialPipelineStage(deal.stage);
    const value = feeValue(deal.value);
    if (stage === 'billed') {
      billed += value;
    } else if (stage === 'under_offer' || stage === 'negotiating') {
      underOffer += value;
    }
  }

  return {
    billed,
    underOffer,
    total: billed + underOffer,
  };
}
