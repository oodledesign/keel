import { cn } from '@kit/ui/utils';

import type { WipRunningTotals } from '~/lib/commercial/wip-running-totals';
import { WIP_STAGE_COLOURS } from '~/lib/commercial/wip-stage-colours';

function formatGbp(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

const METRICS = [
  {
    key: 'billed' as const,
    label: 'Billed',
    testId: 'wip-running-total-billed',
    hint: 'Fees on instructions in the Billed stage',
    colour: WIP_STAGE_COLOURS.billed,
  },
  {
    key: 'completed' as const,
    label: 'Completed (Unbilled)',
    testId: 'wip-running-total-completed',
    hint: 'Exchanged or completed, invoice not yet sent',
    colour: WIP_STAGE_COLOURS.completed,
  },
  {
    key: 'underOffer' as const,
    label: 'Under offer',
    testId: 'wip-running-total-under-offer',
    hint: 'Fees in Under offer. Negotiating is not included',
    colour: WIP_STAGE_COLOURS.under_offer,
  },
  {
    key: 'managed' as const,
    label: 'Managed',
    testId: 'wip-running-total-managed',
    hint: 'Annual management fees',
    colour: WIP_STAGE_COLOURS.managed,
  },
  {
    key: 'total' as const,
    label: 'Total',
    testId: 'wip-running-total-combined',
    hint: 'Billed, completed, under offer, and managed',
    colour: WIP_STAGE_COLOURS.potential,
  },
];

export function WipRunningTotalsCards({
  totals,
  className,
}: {
  totals: WipRunningTotals;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="WIP running totals"
      data-test="wip-running-totals"
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    >
      {METRICS.map((metric) => (
        <div
          key={metric.key}
          data-test={metric.testId}
          title={metric.hint}
          className="inline-flex items-baseline gap-1.5 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] py-1 pr-3 pl-2.5"
          style={{
            borderLeftWidth: 3,
            borderLeftColor: metric.colour.bar,
          }}
        >
          <span
            className="text-xs font-medium"
            style={{ color: metric.colour.label }}
          >
            {metric.label}:
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--workspace-shell-text)] tabular-nums">
            {formatGbp(totals[metric.key])}
          </span>
          <span className="sr-only">{metric.hint}</span>
        </div>
      ))}
    </div>
  );
}
