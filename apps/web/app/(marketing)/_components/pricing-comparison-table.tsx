'use client';

import { useState } from 'react';

import { Check, ChevronDown, Minus } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { cn } from '@kit/ui/utils';

import type {
  PricingComparisonGroup,
  PricingComparisonPlanColumn,
  PricingFeatureCell,
  SegmentPricingComparison,
} from '~/lib/marketing/pricing-comparison';

import {
  marketingBtnOutline,
  marketingBodyText,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

type PricingComparisonTableProps = {
  comparison: SegmentPricingComparison;
  className?: string;
};

export function PricingComparisonTable({
  comparison,
  className,
}: PricingComparisonTableProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <div className="flex flex-col items-center gap-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(marketingBtnOutline, 'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium')}
            aria-expanded={open}
          >
            {open ? 'Hide feature comparison' : 'Compare plans in detail'}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[var(--workspace-shell-text-muted)] transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-8 data-[state=closed]:animate-out data-[state=open]:animate-in">
        <ComparisonTable
          planColumns={comparison.planColumns}
          groups={comparison.groups}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ComparisonTable(props: {
  planColumns: PricingComparisonPlanColumn[];
  groups: PricingComparisonGroup[];
}) {
  const { planColumns, groups } = props;

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)]', marketingFeatureCard)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60">
              <th
                scope="col"
                className={cn('sticky left-0 z-10 min-w-[200px] bg-[var(--workspace-shell-panel)] px-4 py-4 text-xs font-medium uppercase tracking-[0.1em]', marketingMutedText)}
              >
                Feature
              </th>
              {planColumns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    'min-w-[108px] px-4 py-4 text-center text-sm font-semibold text-[var(--workspace-shell-text)]',
                    column.highlighted && 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]',
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group.title}
                group={group}
                planColumns={planColumns}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows(props: {
  group: PricingComparisonGroup;
  planColumns: PricingComparisonPlanColumn[];
}) {
  const { group, planColumns } = props;

  return (
    <>
      <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60">
        <th
          scope="colgroup"
          colSpan={planColumns.length + 1}
          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ozer-accent)]"
        >
          {group.title}
        </th>
      </tr>
      {group.rows.map((row) => (
        <tr
          key={`${group.title}-${row.feature}`}
          className="border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
        >
          <th
            scope="row"
            className={cn('sticky left-0 z-10 bg-[var(--workspace-shell-panel)] px-4 py-3.5 font-normal', marketingBodyText)}
          >
            <span className="block">{row.feature}</span>
            {row.hint ? (
              <span className={cn('mt-0.5 block text-xs', marketingMutedText)}>
                {row.hint}
              </span>
            ) : null}
          </th>
          {planColumns.map((column) => (
            <td
              key={column.id}
              className={cn(
                'px-4 py-3.5 text-center',
                column.highlighted && 'bg-[var(--ozer-accent)]/5',
              )}
            >
              <FeatureCell value={row.values[column.id] ?? false} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FeatureCell(props: { value: PricingFeatureCell }) {
  const { value } = props;

  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="h-4 w-4 text-[var(--ozer-accent)]" aria-label="Included" />
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <Minus className="h-4 w-4 text-[var(--workspace-shell-text-muted)]/40" aria-label="Not included" />
      </span>
    );
  }

  if (value === 'add-on') {
    return (
      <span className={cn('text-xs font-medium', marketingBodyText)}>Add-on</span>
    );
  }

  return <span className="text-sm font-medium text-[var(--workspace-shell-text)]">{value}</span>;
}
