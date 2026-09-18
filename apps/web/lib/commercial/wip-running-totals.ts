import { COMMERCIAL_PIPELINE_WON_STAGE } from '~/lib/commercial/commercial-constants';
import { normalizeCommercialPipelineStage } from '~/lib/commercial/pipeline-stage-config';

export const WIP_UNDER_OFFER_STAGE = 'under_offer_negotiating';

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
 * Billed = completed / exchanged (won). Under offer = under_offer_negotiating.
 */
export function computeWipInstructionTotals(
  deals: readonly WipFeeRow[],
): WipRunningTotals {
  let billed = 0;
  let underOffer = 0;

  for (const deal of deals) {
    const stage = normalizeCommercialPipelineStage(deal.stage);
    const value = feeValue(deal.value);
    if (stage === COMMERCIAL_PIPELINE_WON_STAGE) {
      billed += value;
    } else if (stage === WIP_UNDER_OFFER_STAGE) {
      underOffer += value;
    }
  }

  return {
    billed,
    underOffer,
    total: billed + underOffer,
  };
}
