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

import { WorkspaceOrbitDiagram } from './workspace-orbit-diagram';

type Props = {
  className?: string;
  /** Emphasise personal-free angle on /personal */
  variant?: 'default' | 'personal' | 'work';
};

export function InterconnectedWorkspacesSection({
  className,
  variant = 'default',
}: Props) {
  const m = INTERCONNECTED_WORKSPACES_MARKETING;

  const subtitle =
    variant === 'personal'
      ? `${m.subtitle} Your personal home stays free — workspaces connect around it.`
      : variant === 'work'
        ? `${m.subtitle} Your business CRM sits inside the same Life CRM — not a separate product you will abandon for personal stuff.`
        : m.subtitle;

  return (
    <section
      id="connected-workspaces"
      className={cn(
        'relative overflow-hidden border-y border-[#2A9D8F]/20 bg-[#0d0b1e] py-20 md:py-28',
        className,
      )}
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      aria-labelledby="connected-workspaces-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(42,157,143,0.1),transparent_50%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,38fr)_minmax(0,62fr)] lg:items-center lg:gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#2A9D8F]/35 bg-[#2A9D8F]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#7ee8d8]">
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              {m.eyebrow}
            </span>
            <h2
              id="connected-workspaces-heading"
              className="mt-6 font-heading text-3xl font-bold leading-tight text-white md:text-5xl lg:text-[3.25rem]"
            >
              {m.title}
              <span className="mt-1 block bg-gradient-to-r from-[#2A9D8F] via-teal-200 to-[#2563EB] bg-clip-text text-transparent">
                {m.titleAccent}
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-violet-100/85 md:text-lg">
              {subtitle}
            </p>
          </div>

          <div className="w-full pt-2 md:pt-0">
            <WorkspaceOrbitDiagram nodes={m.workspaceNodes} />
          </div>
        </div>

        <div className="mt-14 lg:mt-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {m.benefits.map((benefit) => (
              <BenefitCard key={benefit.title} benefit={benefit} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border-violet-300/25 bg-white/[0.03] px-6 text-violet-100 hover:bg-white/[0.06]"
            >
              <Link href="/features">
                All features
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 rounded-3xl border border-white/10 bg-[#0B132B]/90 p-6 md:p-10">
          <h3 className="text-center font-heading text-2xl font-semibold text-white md:text-3xl">
            {m.comparison.heading}
          </h3>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <ComparisonColumn
              label={m.comparison.traditionalLabel}
              items={m.comparison.traditional}
              tone="muted"
            />
            <ComparisonColumn
              label={m.comparison.keelLabel}
              items={m.comparison.keel}
              tone="keel"
            />
          </div>
          <p className="mt-8 text-center text-sm font-medium text-[#7ee8d8] md:text-base">
            {m.ctaLine}
          </p>
        </div>
      </div>
    </section>
  );
}

function BenefitCard({ benefit }: { benefit: InterconnectedBenefit }) {
  const Icon = benefit.icon;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0F1B35]/50 p-4 backdrop-blur-sm md:p-5">
      <Icon className="h-5 w-5 shrink-0 text-[#2A9D8F]" aria-hidden />
      <h3 className="mt-3 font-heading text-base font-semibold leading-snug text-white md:text-lg">
        {benefit.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-violet-100/70">
        {benefit.description}
      </p>
    </article>
  );
}

function ComparisonColumn({
  label,
  items,
  tone,
}: {
  label: string;
  items: readonly string[];
  tone: 'muted' | 'keel';
}) {
  const isKeel = tone === 'keel';
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 md:p-6',
        isKeel
          ? 'border-[#2A9D8F]/35 bg-[#2A9D8F]/[0.07]'
          : 'border-white/8 bg-white/[0.02]',
      )}
    >
      <p
        className={cn(
          'text-sm font-semibold uppercase tracking-wide',
          isKeel ? 'text-[#7ee8d8]' : 'text-violet-200/50',
        )}
      >
        {label}
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
            {isKeel ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2A9D8F]" aria-hidden />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/40" aria-hidden />
            )}
            <span className={isKeel ? 'text-violet-50/95' : 'text-violet-100/55'}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
