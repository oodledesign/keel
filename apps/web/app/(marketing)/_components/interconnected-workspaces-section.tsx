import Link from 'next/link';

import {
  ArrowRight,
  Check,
  Link2,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  INTERCONNECTED_WORKSPACES_MARKETING,
  type InterconnectedBenefit,
} from '~/lib/marketing/interconnected-workspaces';
import {
  marketingBtnOutline,
  marketingHeadlineGradient,
} from '~/lib/marketing/marketing-ui';
import type { PricingTone } from '~/lib/marketing/pricing-theme';

import { WorkspaceOrbitDiagram } from './workspace-orbit-diagram';

type Props = {
  className?: string;
  /** Emphasise personal-free angle on /personal */
  variant?: 'default' | 'personal' | 'work';
  tone?: PricingTone;
};

export function InterconnectedWorkspacesSection({
  className,
  variant = 'default',
  tone = 'dark',
}: Props) {
  const m = INTERCONNECTED_WORKSPACES_MARKETING;
  const isLight = tone === 'light';

  const subtitle =
    variant === 'personal'
      ? `${m.subtitle} Your personal home stays free — workspaces connect around it.`
      : variant === 'work'
        ? `${m.subtitle} Your business workspace sits inside the same Ozer account — not a separate product you will abandon for personal stuff.`
        : m.subtitle;

  return (
    <section
      id="connected-workspaces"
      className={cn(
        'relative overflow-hidden py-16 md:py-24',
        isLight
          ? 'border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]'
          : 'border-y border-[var(--ozer-accent)]/20 bg-[var(--ozer-plum-950)]',
        className,
      )}
      aria-labelledby="connected-workspaces-heading"
    >
      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,38fr)_minmax(0,62fr)] lg:items-center lg:gap-8">
          <div>
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]',
                isLight
                  ? 'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)]'
                  : 'border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-400)]',
              )}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              {m.eyebrow}
            </span>
            <h2
              id="connected-workspaces-heading"
              className={cn(
                'mt-6 font-heading text-3xl font-bold leading-tight md:text-5xl lg:text-[3.25rem]',
                isLight
                  ? 'text-[var(--workspace-shell-text)]'
                  : 'text-[var(--ozer-text-on-dark)]',
              )}
            >
              {m.title}
              <span className={cn('mt-1 block', marketingHeadlineGradient)}>
                {m.titleAccent}
              </span>
            </h2>
            <p
              className={cn(
                'mt-5 max-w-xl text-base leading-relaxed md:text-lg',
                isLight
                  ? 'text-[var(--workspace-shell-text-muted)]'
                  : 'text-[var(--ozer-text-on-dark-muted)]',
              )}
            >
              {subtitle}
            </p>
          </div>

          <div className="w-full pt-2 md:pt-0">
            <WorkspaceOrbitDiagram nodes={m.workspaceNodes} tone={tone} />
          </div>
        </div>

        <div className="mt-14 lg:mt-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {m.benefits.map((benefit) => (
              <BenefitCard key={benefit.title} benefit={benefit} tone={tone} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              variant="outline"
              className={cn(
                'h-11 rounded-full px-6',
                isLight
                  ? cn(marketingBtnOutline, 'h-auto')
                  : 'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-on-dark-alpha-06)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-on-dark-alpha-08)]',
              )}
            >
              <Link href="/features">
                All features
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'mt-16 rounded-3xl border p-6 md:p-10',
            isLight
              ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]'
              : 'border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)]',
          )}
        >
          <h3
            className={cn(
              'text-center font-heading text-2xl font-semibold md:text-3xl',
              isLight
                ? 'text-[var(--workspace-shell-text)]'
                : 'text-[var(--ozer-text-on-light)]',
            )}
          >
            {m.comparison.heading}
          </h3>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <ComparisonColumn
              label={m.comparison.traditionalLabel}
              items={m.comparison.traditional}
              tone="muted"
            />
            <ComparisonColumn
              label={m.comparison.ozerLabel}
              items={m.comparison.ozer}
              tone="ozer"
            />
          </div>
          <p
            className={cn(
              'mt-8 text-center text-sm font-medium md:text-base',
              isLight
                ? 'text-[var(--workspace-shell-text-muted)]'
                : 'text-[var(--ozer-plum-700)]',
            )}
          >
            {m.ctaLine}
          </p>
        </div>
      </div>
    </section>
  );
}

function BenefitCard({
  benefit,
  tone = 'dark',
}: {
  benefit: InterconnectedBenefit;
  tone?: PricingTone;
}) {
  const Icon = benefit.icon;
  const isLight = tone === 'light';

  const className = cn(
    'flex h-full flex-col rounded-2xl border p-4 md:p-5',
    isLight
      ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]'
      : 'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)]',
    benefit.href &&
      'transition-[border-color,background-color] duration-200 hover:border-[var(--ozer-accent)]/35',
  );

  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-[var(--ozer-accent)]" aria-hidden />
      <h3
        className={cn(
          'mt-3 font-heading text-base font-semibold leading-snug md:text-lg',
          isLight
            ? 'text-[var(--workspace-shell-text)]'
            : 'text-[var(--ozer-text-on-dark)]',
        )}
      >
        {benefit.title}
      </h3>
      <p
        className={cn(
          'mt-2 flex-1 text-sm leading-relaxed',
          isLight
            ? 'text-[var(--workspace-shell-text-muted)]'
            : 'text-[var(--ozer-text-on-dark-muted)]',
        )}
      >
        {benefit.description}
      </p>
    </>
  );

  if (benefit.href) {
    return (
      <Link href={benefit.href} className={className}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

function ComparisonColumn({
  label,
  items,
  tone,
}: {
  label: string;
  items: readonly string[];
  tone: 'muted' | 'ozer';
}) {
  const isOzer = tone === 'ozer';
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 md:p-6',
        isOzer
          ? 'border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)]'
          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      <p
        className={cn(
          'text-sm font-semibold uppercase tracking-wide',
          isOzer ? 'text-[var(--ozer-coral-600)]' : 'text-[var(--ozer-plum-700)]',
        )}
      >
        {label}
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
            {isOzer ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" aria-hidden />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" aria-hidden />
            )}
            <span className={isOzer ? 'text-[var(--ozer-text-on-light)]' : 'text-[var(--ozer-text-on-light-muted)]'}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
