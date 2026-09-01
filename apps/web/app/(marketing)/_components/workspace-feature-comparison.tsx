'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Check, ChevronDown, Minus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';
import {
  WORKSPACE_FEATURE_COLUMNS,
  WORKSPACE_FEATURE_EXTRA_ROWS,
  WORKSPACE_FEATURE_PREVIEW_ROWS,
  WORKSPACE_FEATURE_ROWS,
  WORKSPACE_FEATURE_SURVEYOR_NOTE,
  type WorkspaceFeatureCell,
  type WorkspaceFeatureColumn,
  type WorkspaceFeatureRow,
} from '~/lib/marketing/workspace-feature-matrix';

type WorkspaceFeatureComparisonProps = {
  variant: 'preview' | 'full';
  className?: string;
};

export function WorkspaceFeatureComparison({
  variant,
  className,
}: WorkspaceFeatureComparisonProps) {
  const [showAll, setShowAll] = useState(variant === 'full');
  const previewRows =
    variant === 'full'
      ? WORKSPACE_FEATURE_ROWS
      : WORKSPACE_FEATURE_PREVIEW_ROWS;
  const extraRows = variant === 'full' ? [] : WORKSPACE_FEATURE_EXTRA_ROWS;
  const headingId =
    variant === 'full'
      ? 'workspace-features-pricing-heading'
      : 'workspace-features-heading';

  return (
    <section
      id="workspaces"
      className={cn(
        variant === 'full'
          ? 'relative w-full'
          : 'relative mx-auto w-full max-w-7xl px-6 pt-8 pb-20 md:pt-12 md:pb-28',
        className,
      )}
      aria-labelledby={headingId}
    >
      <div
        className={cn(
          variant === 'full' ? 'max-w-3xl' : 'mx-auto max-w-3xl text-center',
        )}
      >
        <h2
          id={headingId}
          className={cn(
            'font-heading font-bold tracking-tight text-[var(--workspace-shell-text)]',
            variant === 'full'
              ? 'text-2xl md:text-3xl'
              : 'text-3xl md:text-5xl md:tracking-[-0.02em]',
          )}
        >
          Which Ozer workspace?
        </h2>
        <p
          className={cn(
            'mt-3 text-base font-medium text-[var(--workspace-shell-text)]',
            variant === 'full' ? 'md:text-base' : 'md:text-lg',
          )}
        >
          Business for studios. Commercial property for agency desks. Same
          account — pick the workspace that matches the work.
        </p>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-[1.5rem] border border-[color:var(--workspace-shell-border)]',
          marketingFeatureCard,
          variant === 'full' ? 'mt-6' : 'mt-10',
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
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
                {WORKSPACE_FEATURE_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      'min-w-[10rem] px-3 py-5 text-center align-bottom',
                      column.highlighted && 'bg-[var(--ozer-accent)]/[0.06]',
                    )}
                  >
                    <ColumnHeader column={column} />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row) => (
                <FeatureRow key={row.id} row={row} />
              ))}
            </tbody>

            {variant === 'preview' ? (
              <tbody id="workspace-feature-extra-rows">
                {showAll
                  ? extraRows.map((row) => (
                      <FeatureRow key={row.id} row={row} />
                    ))
                  : null}
              </tbody>
            ) : null}

            {variant === 'preview' ? (
              <tbody>
                <tr className="border-b border-[color:var(--workspace-shell-border)]">
                  <td
                    colSpan={WORKSPACE_FEATURE_COLUMNS.length + 1}
                    className="bg-[var(--workspace-shell-panel)] px-4 py-3"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full py-1 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:text-[var(--ozer-accent)]"
                      aria-expanded={showAll}
                      aria-controls="workspace-feature-extra-rows"
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
              </tbody>
            ) : null}

            <tbody>
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-20 bg-[var(--workspace-shell-panel)] px-4 py-5 text-left text-sm font-semibold text-[var(--workspace-shell-text)]"
                >
                  Price
                </th>
                {WORKSPACE_FEATURE_COLUMNS.map((column) => (
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

      <p
        className={cn(
          'mt-4 text-sm',
          marketingMutedText,
          variant !== 'full' && 'text-center',
        )}
      >
        {WORKSPACE_FEATURE_SURVEYOR_NOTE}
      </p>
      <p
        className={cn(
          'mt-2 text-xs',
          marketingMutedText,
          variant !== 'full' && 'text-center',
        )}
      >
        iOS is a native iPhone app in progress — not in the App Store yet.
        Personal and family stay free and are not shown on this business table.
      </p>

      {variant === 'preview' ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className={marketingBtnGradient}>
            <Link href="/pricing">See pricing</Link>
          </Button>
          <Button asChild variant="outline" className={marketingBtnOutline}>
            <Link href="/work">Business workspace</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ColumnHeader({ column }: { column: WorkspaceFeatureColumn }) {
  return (
    <div className="mx-auto flex max-w-[11rem] flex-col items-center gap-2">
      <span className="font-heading text-sm font-semibold text-[var(--workspace-shell-text)]">
        {column.name}
      </span>
      <span className={cn('text-[0.65rem] leading-snug', marketingMutedText)}>
        {column.blurb}
      </span>
      <Link
        href={column.href}
        className="text-[0.65rem] font-medium text-[var(--ozer-coral-600)] underline-offset-2 hover:underline"
      >
        Learn more
      </Link>
    </div>
  );
}

function FeatureRow({ row }: { row: WorkspaceFeatureRow }) {
  return (
    <tr className="border-b border-[color:var(--workspace-shell-border)]">
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 bg-[var(--workspace-shell-panel)] px-4 py-3.5 text-left font-normal',
          marketingBodyText,
        )}
      >
        {row.href ? (
          <Link
            href={row.href}
            className="block text-sm font-medium text-[var(--workspace-shell-text)] underline-offset-2 hover:underline"
            title={row.hint}
          >
            {row.feature}
          </Link>
        ) : (
          <span
            className="block text-sm font-medium text-[var(--workspace-shell-text)]"
            title={row.hint}
          >
            {row.feature}
          </span>
        )}
        {row.hint ? <span className="sr-only">{row.hint}</span> : null}
      </th>
      {WORKSPACE_FEATURE_COLUMNS.map((column) => (
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
  value: WorkspaceFeatureCell;
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
        <span className="sr-only"> — shared assistant, not a desk module</span>
      </span>
    );
  }

  if (value === 'coming') {
    return (
      <span className="text-[0.7rem] font-semibold tracking-[0.04em] text-[var(--ozer-coral-600)] uppercase">
        Soon
      </span>
    );
  }

  if (typeof value === 'string') {
    return (
      <span className={cn('text-[0.7rem] font-medium', marketingBodyText)}>
        {value}
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
