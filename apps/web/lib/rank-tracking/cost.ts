import type { DfsResponse } from '~/lib/dataforseo/client';

type TaskWithCost = {
  cost?: number;
};

export function extractApiCost(json: DfsResponse & { cost?: number }): number {
  let total = Number(json.cost ?? 0);

  for (const task of json.tasks ?? []) {
    total += Number((task as TaskWithCost).cost ?? 0);
  }

  return Math.round(total * 1_000_000) / 1_000_000;
}

export function formatUsdCost(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatUsageLabel(input: {
  tasksCompleted: number;
  tasksTotal: number;
  apiCostUsd: number;
}): string {
  return `${input.tasksCompleted}/${input.tasksTotal} lookups · ${formatUsdCost(input.apiCostUsd)} API spend`;
}
