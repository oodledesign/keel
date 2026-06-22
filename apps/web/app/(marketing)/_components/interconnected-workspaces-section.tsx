import {
  Briefcase,
  Check,
  Heart,
  Home,
  Link2,
  Users,
  X,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  INTERCONNECTED_WORKSPACES_MARKETING,
  type InterconnectedBenefit,
  type InterconnectedWorkspaceNode,
} from '~/lib/marketing/interconnected-workspaces';

import { WorkspaceOrbitDiagram } from './workspace-orbit-diagram';

type Props = {
  className?: string;
  /** Emphasise personal-free angle on /personal */
  variant?: 'default' | 'personal' | 'work';
};

const NODE_ICONS: Record<string, typeof Home> = {
  work: Briefcase,
  family: Heart,
  community: Users,
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
        'relative overflow-hidden border-y border-[#2A9D8F]/20 bg-[linear-gradient(180deg,rgba(42,157,143,0.08)_0%,rgba(5,5,11,0)_45%,rgba(37,99,235,0.06)_100%)] py-20 md:py-28',
        className,
      )}
      aria-labelledby="connected-workspaces-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(42,157,143,0.12),transparent_55%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-[45%_55%] lg:items-start lg:gap-10">
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
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-violet-100/85 md:text-lg">
              {subtitle}
            </p>

            <div className="mt-8 space-y-4">
              {m.benefits.map((benefit) => (
                <BenefitCard key={benefit.title} benefit={benefit} />
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <WorkspaceOrbitDiagram nodes={m.workspaceNodes} />
          </div>
        </div>

        <div className="mt-14 lg:hidden">
          <WorkspaceHubDiagram
            hubLabel={m.hubLabel}
            hubCaption={m.hubCaption}
            nodes={m.workspaceNodes}
          />
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

function WorkspaceHubDiagram({
  hubLabel,
  hubCaption,
  nodes,
}: {
  hubLabel: string;
  hubCaption: string;
  nodes: InterconnectedWorkspaceNode[];
}) {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="flex flex-col items-center gap-8">
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#2A9D8F]/40 bg-[linear-gradient(145deg,rgba(42,157,143,0.18),rgba(11,19,43,0.95))] px-6 py-5 text-center shadow-[0_0_60px_rgba(42,157,143,0.15)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7ee8d8]">
            {hubLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            One calm command centre
          </p>
          <p className="mt-1 text-sm text-violet-100/70">{hubCaption}</p>
        </div>

        <div
          className="hidden h-8 w-px bg-gradient-to-b from-[#2A9D8F]/60 to-white/10 md:block"
          aria-hidden
        />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => {
            const Icon = NODE_ICONS[node.id] ?? Briefcase;
            return (
              <div
                key={node.id}
                className="relative rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center transition hover:border-white/20"
              >
                <span
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10"
                  style={{ backgroundColor: `${node.color}22` }}
                >
                  <Icon className="h-5 w-5" style={{ color: node.color }} />
                </span>
                <p className="mt-3 text-sm font-semibold text-white">{node.label}</p>
                <p className="mt-1 text-xs text-violet-100/60">{node.examples}</p>
              </div>
            );
          })}
        </div>

        <p className="max-w-lg text-center text-xs text-violet-200/55">
          Add workspaces as life grows — personal home stays the hub that ties them
          together. Unlike traditional CRMs, nothing gets walled off.
        </p>
      </div>
    </div>
  );
}

function BenefitCard({ benefit }: { benefit: InterconnectedBenefit }) {
  const Icon = benefit.icon;
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0F1B35]/60 p-5 backdrop-blur">
      <Icon className="h-5 w-5 text-[#2A9D8F]" aria-hidden />
      <h3 className="mt-3 font-heading text-lg font-semibold text-white">
        {benefit.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-violet-100/75">
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
