import Link from 'next/link';

import { ArrowRight, Link2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';
import {
  INTERCONNECTED_WORKSPACES_MARKETING,
  type InterconnectedBentoTile,
  type InterconnectedBentoVisual,
} from '~/lib/marketing/interconnected-workspaces';
import {
  marketingBtnOutline,
  marketingHeadlineGradient,
} from '~/lib/marketing/marketing-ui';
import type { PricingTone } from '~/lib/marketing/pricing-theme';

import {
  MarketingBentoAccentCta,
  MarketingBentoGrid,
  MarketingBentoTile,
} from './marketing-bento';
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
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase',
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
                'font-heading mt-6 text-3xl leading-tight font-bold md:text-5xl lg:text-[3.25rem]',
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
          <div className="mb-8 max-w-2xl">
            <h3
              className={cn(
                'font-heading text-2xl font-semibold md:text-3xl',
                isLight
                  ? 'text-[var(--workspace-shell-text)]'
                  : 'text-[var(--ozer-text-on-dark)]',
              )}
            >
              {m.bentoHeading}
            </h3>
            <p
              className={cn(
                'mt-2 text-sm leading-relaxed md:text-base',
                isLight
                  ? 'text-[var(--workspace-shell-text-muted)]'
                  : 'text-[var(--ozer-text-on-dark-muted)]',
              )}
            >
              {m.bentoSubheading}
            </p>
          </div>

          <MarketingBentoGrid>
            {m.bentoTiles.map((tile) => (
              <BentoTile key={tile.id} tile={tile} isLight={isLight} />
            ))}
          </MarketingBentoGrid>

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
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <p
            className={cn(
              'mt-8 text-center text-sm font-medium md:text-base',
              isLight
                ? 'text-[var(--workspace-shell-text-muted)]'
                : 'text-[var(--ozer-text-on-dark-muted)]',
            )}
          >
            {m.ctaLine}
          </p>
        </div>
      </div>
    </section>
  );
}

function BentoTile({
  tile,
  isLight,
}: {
  tile: InterconnectedBentoTile;
  isLight: boolean;
}) {
  if (tile.variant === 'accent') {
    return (
      <MarketingBentoAccentCta
        title={tile.title}
        description={tile.description}
        href={tile.href ?? MARKETING_FREE_SIGNUP_URL}
        ctaLabel={tile.ctaLabel}
      />
    );
  }

  const Icon = tile.icon;
  const tileVariant = tile.variant === 'visual' ? 'cream' : 'muted';
  const onDarkCream = !isLight && tileVariant === 'cream';

  return (
    <MarketingBentoTile
      span={tile.span === 'lg' ? 'wide' : tile.span === 'md' ? 'tall' : 'sm'}
      variant={tileVariant}
      href={tile.href}
      className={cn(
        onDarkCream &&
          'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)]',
        !isLight &&
          tileVariant === 'muted' &&
          'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-900)]',
      )}
      visual={
        tile.visual && tile.visual !== 'none' ? (
          <BentoVisual kind={tile.visual} accent={!isLight} />
        ) : Icon ? (
          <div className="flex w-full justify-start">
            <span
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-2xl border',
                isLight
                  ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--ozer-accent)]'
                  : 'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-on-dark-alpha-06)] text-[var(--ozer-coral-400)]',
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
          </div>
        ) : undefined
      }
    >
      <h3
        className={cn(
          'font-heading text-lg leading-snug font-semibold md:text-xl',
          isLight
            ? 'text-[var(--workspace-shell-text)]'
            : 'text-[var(--ozer-text-on-dark)]',
        )}
      >
        {tile.title}
      </h3>
      <p
        className={cn(
          'mt-2 text-sm leading-relaxed',
          isLight
            ? 'text-[var(--workspace-shell-text-muted)]'
            : 'text-[var(--ozer-text-on-dark-muted)]',
        )}
      >
        {tile.description}
      </p>
    </MarketingBentoTile>
  );
}

function BentoVisual({
  kind,
  accent,
}: {
  kind: Exclude<InterconnectedBentoVisual, 'none'>;
  accent?: boolean;
}) {
  const bar = accent ? 'var(--ozer-coral-400)' : 'var(--ozer-coral-500)';
  const soft = accent
    ? 'color-mix(in srgb, var(--ozer-coral-400) 35%, transparent)'
    : 'var(--ozer-coral-alpha-15)';

  if (kind === 'tasks') {
    return (
      <div
        aria-hidden
        className="flex h-28 w-full items-end justify-center gap-2 px-4"
      >
        {[40, 70, 55, 88, 62].map((h, i) => (
          <span
            key={`bar-${h}-${i}`}
            className="w-3 rounded-full shadow-[0_0_18px_var(--ozer-coral-alpha-45)]"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg, ${bar}, ${soft})`,
            }}
          />
        ))}
      </div>
    );
  }

  if (kind === 'team') {
    const petals = [
      { label: 'Personal', color: 'var(--ozer-coral-500)', angle: 0 },
      { label: 'Business', color: 'var(--ozer-sky-200)', angle: 72 },
      { label: 'Family', color: 'var(--ozer-sage-500)', angle: 144 },
      { label: 'Property', color: 'var(--ozer-info)', angle: 216 },
      { label: 'Community', color: 'var(--ozer-coral-400)', angle: 288 },
    ] as const;

    return (
      <div
        aria-hidden
        className="relative flex h-28 w-full items-center justify-center"
      >
        <svg
          viewBox="0 0 120 120"
          className="h-[7.25rem] w-[7.25rem] drop-shadow-[0_0_18px_var(--ozer-coral-alpha-15)]"
        >
          <g transform="translate(60 60)">
            {petals.map((petal) => (
              <g key={petal.label} transform={`rotate(${petal.angle})`}>
                {/* Arm connecting tip to centre */}
                <line
                  x1="0"
                  y1="-8"
                  x2="0"
                  y2="-34"
                  stroke={petal.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.55"
                />
                {/* Petal / star arm */}
                <ellipse
                  cx="0"
                  cy="-26"
                  rx="11"
                  ry="20"
                  fill={petal.color}
                  opacity="0.92"
                />
                {/* Workspace node at the tip */}
                <circle
                  cx="0"
                  cy="-42"
                  r="6.5"
                  fill={petal.color}
                  stroke="var(--workspace-shell-panel)"
                  strokeWidth="2"
                />
              </g>
            ))}
            {/* Centre hub — one login */}
            <circle
              cx="0"
              cy="0"
              r="14"
              fill="var(--ozer-coral-500)"
              stroke="var(--workspace-shell-panel)"
              strokeWidth="3"
            />
            <circle cx="0" cy="0" r="5.5" fill="var(--ozer-cream-50)" />
          </g>
        </svg>
      </div>
    );
  }

  if (kind === 'spark') {
    return (
      <div
        aria-hidden
        className="relative flex h-28 w-full items-center justify-center"
      >
        <span className="absolute size-24 rounded-full border border-[var(--ozer-coral-alpha-15)]" />
        <span className="absolute size-16 rounded-full border border-[var(--ozer-coral-alpha-45)]" />
        <svg
          viewBox="0 0 48 48"
          className="relative size-14 text-[var(--ozer-coral-500)] drop-shadow-[0_0_18px_var(--ozer-coral-alpha-45)]"
        >
          <path
            fill="currentColor"
            d="M27.5 4 12 26h10l-2.5 18L36 22H26l1.5-18Z"
          />
        </svg>
      </div>
    );
  }

  if (kind === 'activity') {
    return (
      <div aria-hidden className="relative flex h-24 w-full items-center px-2">
        <svg viewBox="0 0 220 80" className="h-full w-full" fill="none">
          <path
            d="M4 58 C 30 58, 36 22, 58 22 S 90 62, 112 48 S 150 12, 170 28 S 200 54, 216 40"
            stroke={bar}
            strokeWidth="3"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_var(--ozer-coral-alpha-45)]"
          />
          <circle cx="170" cy="28" r="6" fill={bar} />
          <circle
            cx="170"
            cy="28"
            r="12"
            stroke={soft}
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
    );
  }

  // support — chat pill
  return (
    <div
      aria-hidden
      className="flex h-24 w-full items-center justify-center px-2"
    >
      {' '}
      <div
        className={cn(
          'flex max-w-[16rem] items-center gap-3 rounded-full border px-3 py-2 shadow-[0_10px_30px_var(--ozer-plum-alpha-12)]',
          'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
        )}
      >
        <span className="size-9 shrink-0 rounded-full bg-[linear-gradient(135deg,var(--ozer-coral-500),var(--ozer-coral-400))]" />
        <div className="min-w-0 text-left">
          <p className="truncate text-xs font-semibold text-[var(--workspace-shell-text)]">
            Ozer Assistant
          </p>
          <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
            Tasks ready from your last call.
          </p>
        </div>
      </div>
    </div>
  );
}
