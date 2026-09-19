import { Card, CardContent } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import type { WipRunningTotals } from '~/lib/commercial/wip-running-totals';
import { WIP_STAGE_COLOURS } from '~/lib/commercial/wip-stage-colours';
import { workspacePanelCard } from '~/lib/workspace-ui';

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
    hint: 'Completed and exchanged instruction fees',
    colour: WIP_STAGE_COLOURS.completed_exchanged,
  },
  {
    key: 'underOffer' as const,
    label: 'Under offer',
    testId: 'wip-running-total-under-offer',
    hint: 'Fees currently under offer or negotiating',
    colour: WIP_STAGE_COLOURS.under_offer_negotiating,
  },
  {
    key: 'total' as const,
    label: 'Total',
    testId: 'wip-running-total-combined',
    hint: 'Billed plus under offer',
    // Navy / --ozer-info — same swatch as Potential columns, used here as
    // combined emphasis rather than the early-funnel stage meaning.
    colour: WIP_STAGE_COLOURS.potential,
    emphasize: true,
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
      className={cn(
        'grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3',
        className,
      )}
    >
      {METRICS.map((metric) => (
        <Card
          key={metric.key}
          data-test={metric.testId}
          className={cn(workspacePanelCard, 'overflow-hidden py-0')}
          style={{
            borderTopWidth: 3,
            borderTopColor: metric.colour.bar,
            background: metric.colour.tint,
          }}
        >
          <CardContent className="px-3 py-2">
            <p
              className="text-[10px] font-semibold tracking-wide uppercase"
              style={{ color: metric.colour.label }}
            >
              {metric.label}
            </p>
            <p
              className={cn(
                'mt-0.5 font-semibold tracking-tight tabular-nums',
                metric.emphasize ? 'text-lg' : 'text-base',
              )}
              style={{ color: metric.colour.label }}
            >
              {formatGbp(totals[metric.key])}
            </p>
            <span className="sr-only">{metric.hint}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
