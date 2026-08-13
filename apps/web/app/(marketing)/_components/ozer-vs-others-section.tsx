'use client';

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { Check, ChevronDown, Minus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  COMPETITOR_MATRIX_COLUMNS,
  COMPETITOR_MATRIX_EXTRA_ROWS,
  COMPETITOR_MATRIX_PREVIEW_ROWS,
  type CompetitorMatrixCell,
  type CompetitorMatrixColumn,
  type CompetitorMatrixRow,
} from '~/lib/marketing/competitor-matrix';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

export function OzerVsOthersSection() {
  const [showAll, setShowAll] = useState(false);

  return (
    <section
      id="compare"
      className="relative mx-auto w-full max-w-7xl px-6 pt-8 pb-20 md:pt-12 md:pb-28"
      aria-labelledby="ozer-vs-others-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="ozer-vs-others-heading"
          className="font-heading text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-5xl md:tracking-[-0.02em]"
        >
          Ozer vs the others
        </h2>
        <p className="mt-3 text-base font-medium text-[var(--workspace-shell-text)] md:text-lg">
          Get way more of your work — and your life — in one place from{' '}
          <span className="text-[var(--ozer-accent)]">£29/mo</span>.
        </p>
      </div>

      <div
        className={cn(
          'mt-10 overflow-hidden rounded-[1.5rem] border border-[color:var(--workspace-shell-border)]',
          marketingFeatureCard,
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--workspace-shell-border)]">
                <th
                  scope="col"
                  className={cn(
                    'sticky left-0 z-20 min-w-[11rem] bg-[var(--workspace-shell-panel)] px-4 py-5 text-left text-xs font-medium tracking-[0.1em] uppercase',
                    marketingMutedText,
                  )}
                >
                  Feature
                </th>
                {COMPETITOR_MATRIX_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      'min-w-[7.5rem] px-3 py-5 text-center align-bottom',
                      column.highlighted && 'bg-[var(--ozer-accent)]/[0.06]',
                    )}
                  >
                    <ColumnHeader column={column} />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {COMPETITOR_MATRIX_PREVIEW_ROWS.map((row) => (
                <FeatureRow key={row.id} row={row} />
              ))}
            </tbody>

            <tbody id="comparison-extra-rows">
              {showAll
                ? COMPETITOR_MATRIX_EXTRA_ROWS.map((row) => (
                    <FeatureRow key={row.id} row={row} />
                  ))
                : null}
            </tbody>

            <tbody>
              <tr className="border-b border-[color:var(--workspace-shell-border)]">
                <td
                  colSpan={COMPETITOR_MATRIX_COLUMNS.length + 1}
                  className="bg-[var(--workspace-shell-panel)] px-4 py-3"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full py-1 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:text-[var(--ozer-accent)]"
                    aria-expanded={showAll}
                    aria-controls="comparison-extra-rows"
                    onClick={() => setShowAll((current) => !current)}
                  >
                    {showAll ? 'Show fewer features' : 'Show all features'}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-[var(--workspace-shell-text-muted)] transition-transform duration-200',
                        showAll && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>
                </td>
              </tr>

              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-20 bg-[var(--workspace-shell-panel)] px-4 py-5 text-left text-sm font-semibold text-[var(--workspace-shell-text)]"
                >
                  Price
                </th>
                {COMPETITOR_MATRIX_COLUMNS.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-3 py-5 text-center align-middle',
                      column.highlighted && 'bg-[var(--ozer-accent)]/[0.06]',
                    )}
                  >
                    {column.highlighted ? (
                      <span className="relative inline-flex items-center justify-center px-2 py-1">
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-[-0.35rem_-0.55rem] [transform:rotate(-2deg)] rounded-[999px] border-[1.5px] border-[var(--ozer-accent)] opacity-90"
                        />
                        <span className="relative text-sm font-bold text-[var(--ozer-accent)]">
                          {column.price}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'text-xs font-medium md:text-sm',
                          marketingBodyText,
                        )}
                      >
                        {column.price}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className={cn('mt-4 text-center text-xs', marketingMutedText)}>
        Feature coverage is indicative by product family and common mid-tier
        plans — details change. Competitor prices shown in their published
        currency.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild className={marketingBtnGradient}>
          <Link href="/pricing">See Ozer pricing</Link>
        </Button>
        <Button asChild variant="outline" className={marketingBtnOutline}>
          <Link href="/compare">Compare in detail</Link>
        </Button>
      </div>
    </section>
  );
}

function ColumnHeader({ column }: { column: CompetitorMatrixColumn }) {
  return (
    <div className="mx-auto flex max-w-[7.5rem] flex-col items-center gap-2">
      {column.highlighted ? (
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--ozer-accent)]/15">
          <Image
            src="/brand/ozer-icon.svg"
            alt=""
            width={22}
            height={22}
            className="size-[22px]"
          />
        </span>
      ) : (
        <span
          className="inline-flex size-9 items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs font-bold tracking-tight text-[var(--workspace-shell-text)]"
          aria-hidden
        >
          {column.initials}
        </span>
      )}
      <span className="font-heading text-sm font-semibold text-[var(--workspace-shell-text)]">
        {column.name}
      </span>
      <span className={cn('text-[0.65rem] leading-snug', marketingMutedText)}>
        {column.blurb}
      </span>
    </div>
  );
}

function FeatureRow({ row }: { row: CompetitorMatrixRow }) {
  return (
    <tr className="border-b border-[color:var(--workspace-shell-border)]">
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 bg-[var(--workspace-shell-panel)] px-4 py-3.5 text-left font-normal',
          marketingBodyText,
        )}
      >
        <span
          className="block text-sm font-medium text-[var(--workspace-shell-text)]"
          title={row.hint}
        >
          {row.feature}
        </span>
        {row.hint ? <span className="sr-only">{row.hint}</span> : null}
      </th>
      {COMPETITOR_MATRIX_COLUMNS.map((column) => (
        <td
          key={column.id}
          className={cn(
            'px-3 py-3.5 text-center',
            column.highlighted && 'bg-[var(--ozer-accent)]/[0.06]',
          )}
        >
          <MatrixCell
            value={row.values[column.id] ?? false}
            highlighted={Boolean(column.highlighted)}
          />
        </td>
      ))}
    </tr>
  );
}

function MatrixCell({
  value,
  highlighted,
}: {
  value: CompetitorMatrixCell;
  highlighted: boolean;
}) {
  if (value === true) {
    return (
      <span
        role="img"
        aria-label="Included"
        className="inline-flex items-center justify-center"
      >
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full',
            highlighted
              ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
              : 'bg-[var(--workspace-shell-text)] text-[var(--workspace-shell-panel)]',
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        </span>
      </span>
    );
  }

  if (value === 'partial') {
    return (
      <span className={cn('text-[0.7rem] font-medium', marketingMutedText)}>
        Partial
        <span className="sr-only"> — higher plan or add-on</span>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Not included"
      className="inline-flex items-center justify-center"
    >
      <Minus
        className="h-4 w-4 text-[var(--workspace-shell-text-muted)]"
        aria-hidden
      />
    </span>
  );
}
