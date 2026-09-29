import { normalizeCommercialPipelineStage } from '~/lib/commercial/pipeline-stage-config';

/** Under offer card is that stage only. Negotiating stays off the total. */
export const WIP_UNDER_OFFER_TOTAL_STAGES = ['under_offer'] as const;

export type WipRunningTotals = {
  billed: number;
  completed: number;
  underOffer: number;
  managed: number;
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
 * Billed, Completed (not yet billed), Under offer, and Managed.
 * Negotiating, current, potential, and fallen through stay off the cards.
 * Combined stages still waiting to be filed (`completed_exchanged`,
 * `under_offer_negotiating`) are not guessed into a new column.
 */
export function computeWipInstructionTotals(
  deals: readonly WipFeeRow[],
): WipRunningTotals {
  let billed = 0;
  let completed = 0;
  let underOffer = 0;
  let managed = 0;

  for (const deal of deals) {
    const stage = normalizeCommercialPipelineStage(deal.stage);
    const value = feeValue(deal.value);
    if (stage === 'billed') {
      billed += value;
    } else if (stage === 'completed') {
      completed += value;
    } else if (stage === 'under_offer') {
      underOffer += value;
    } else if (stage === 'managed') {
      managed += value;
    }
  }

  return {
    billed,
    completed,
    underOffer,
    managed,
    total: billed + completed + underOffer + managed,
  };
}
