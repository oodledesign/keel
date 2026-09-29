import { normalizeCommercialPipelineStage } from '~/lib/commercial/pipeline-stage-config';

export type WipStageForecast = {
  count: number;
  fee: number;
};

type WipFeeRow = {
  stage: string;
  value?: number | null;
};

function feeValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const EMPTY_FORECAST: WipStageForecast = { count: 0, fee: 0 };

/**
 * Count and fee forecast for each normalised instruction stage.
 * Fee uses the instruction value (the same figure as the running-total cards).
 */
export function computeWipStageForecasts(
  deals: readonly WipFeeRow[],
): Record<string, WipStageForecast> {
  const totals: Record<string, WipStageForecast> = {};

  for (const deal of deals) {
    const stage = String(normalizeCommercialPipelineStage(deal.stage));
    const current = totals[stage] ?? { count: 0, fee: 0 };
    current.count += 1;
    current.fee += feeValue(deal.value);
    totals[stage] = current;
  }

  return totals;
}

export function wipStageForecast(
  forecasts: Record<string, WipStageForecast>,
  stage: string,
): WipStageForecast {
  const key = String(normalizeCommercialPipelineStage(stage));
  return forecasts[key] ?? forecasts[stage] ?? EMPTY_FORECAST;
}

export function formatWipStageForecast(forecast: WipStageForecast): string {
  const fee = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(forecast.fee);
  return `${forecast.count} · ${fee}`;
}
