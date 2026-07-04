'use client';

import { useEffect, useState } from 'react';

import { Briefcase, Check, Heart, Home, Plus, Users } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  PERSONAL_ASSISTANTS_MARKETING,
  type InterconnectedWorkspaceNode,
  type PersonalAssistantMarketing,
} from '~/lib/marketing/interconnected-workspaces';
import type { PricingTone } from '~/lib/marketing/pricing-theme';

/** One full circuit traversal — slower than the original 2.5s. */
const DOT_DURATION_S = 6;

const OUTER_NODE_ICONS: Record<string, typeof Home> = {
  work: Briefcase,
  family: Heart,
  community: Users,
};

type OrbitNode = InterconnectedWorkspaceNode & {
  orbitId: 'business' | 'family' | 'community';
};

const HUB_X = 50;
const HUB_Y = 50;

const OUTER_CIRCUIT_PATHS = [
  {
    id: 'business',
    d: `M ${HUB_X} 14 L ${HUB_X} 34 L 40 34 L 40 ${HUB_Y} L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['0s', '3s'],
  },
  {
    id: 'family',
    d: `M 86 ${HUB_Y} L 58 ${HUB_Y} L 58 42 L ${HUB_X} 42 L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['1.9s', '4.9s'],
  },
  {
    id: 'community',
    d: `M ${HUB_X} 86 L ${HUB_X} 58 L 60 58 L 60 ${HUB_Y} L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['3.8s', '6.8s'],
  },
] as const;

const ASSISTANT_CIRCUIT_PATHS = [
  {
    id: 'email',
    d: `M 14 22 L 32 22 L 32 44 L ${HUB_X} 44 L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['0.5s', '3.5s'],
  },
  {
    id: 'meeting',
    d: `M 14 ${HUB_Y} L 40 ${HUB_Y} L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['1.4s', '4.4s'],
  },
  {
    id: 'planner',
    d: `M 14 78 L 32 78 L 32 56 L ${HUB_X} 56 L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['2.4s', '5.4s'],
  },
] as const;

const ALL_DOT_BEGINS = [
  ...OUTER_CIRCUIT_PATHS.flatMap((path) => path.dotBegin),
  ...ASSISTANT_CIRCUIT_PATHS.flatMap((path) => path.dotBegin),
] as const;

function useHubBorderPulse(begins: readonly string[], durationS: number) {
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    const durMs = durationS * 1000;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const flash = () => {
      setFlashing(true);
      const off = window.setTimeout(() => setFlashing(false), 220);
      timeouts.push(off);
    };

    for (const begin of begins) {
      const beginMs = parseFloat(begin) * 1000;
      const firstHitDelay = beginMs + durMs;

      const startTimer = window.setTimeout(() => {
        flash();
        const interval = window.setInterval(flash, durMs);
        intervals.push(interval);
      }, firstHitDelay);
      timeouts.push(startTimer);
    }

    return () => {
      timeouts.forEach((timer) => window.clearTimeout(timer));
      intervals.forEach((interval) => window.clearInterval(interval));
    };
  }, [begins, durationS]);

  return flashing;
}

function CircuitPaths({
  paths,
}: {
  paths: readonly { id: string; d: string; dotBegin: readonly string[] }[];
}) {
  return (
    <>
      {paths.map((path) => (
        <g key={path.id}>
          <path
            d={path.d}
            fill="none"
            stroke="var(--ozer-coral-alpha-45)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {path.dotBegin.map((begin) => (
            <circle
              key={`${path.id}-${begin}`}
              r="1"
              fill="var(--ozer-accent)"
              style={{ filter: 'drop-shadow(0 0 2px var(--ozer-coral-alpha-45))' }}
            >
              <animateMotion
                dur={`${DOT_DURATION_S}s`}
                repeatCount="indefinite"
                begin={begin}
                path={path.d}
              />
            </circle>
          ))}
        </g>
      ))}
    </>
  );
}

function OrbitWorkspaceCard({
  node,
  className,
  compact = false,
}: {
  node: OrbitNode;
  className?: string;
  compact?: boolean;
}) {
  const Icon = OUTER_NODE_ICONS[node.id] ?? Briefcase;

  return (
    <div
      className={cn(
        'relative z-10 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] text-center shadow-[0_8px_24px_var(--ozer-plum-alpha-18)]',
        compact
          ? 'w-full px-1.5 py-2'
          : 'w-[104px] px-2 py-2.5 sm:w-[128px] sm:px-3 sm:py-3 lg:w-[140px]',
        className,
      )}
    >
      <span
        className={cn(
          'mx-auto flex items-center justify-center rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)]',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
        style={{ backgroundColor: `${node.color}22` }}
      >
        <Icon
          className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          style={{ color: node.color }}
          aria-hidden
        />
      </span>
      <p
        className={cn(
          'font-bold text-[var(--ozer-text-on-light)]',
          compact ? 'mt-1.5 text-[10px] leading-tight' : 'mt-2 text-sm',
        )}
      >
        {compact && node.id === 'family' ? 'Family' : node.label}
      </p>
      {!compact ? (
        <p className="mt-1.5 text-[9px] leading-snug text-[var(--ozer-plum-600)] sm:mt-2 sm:text-[10px]">
          {node.examples}
        </p>
      ) : null}
    </div>
  );
}

function AssistantBillingBadge({
  assistant,
  tone = 'dark',
}: {
  assistant: PersonalAssistantMarketing;
  tone?: PricingTone;
}) {
  const isAddon = assistant.billing === 'addon';
  const isLight = tone === 'light';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border',
            isAddon
              ? 'border-[color:var(--ozer-coral-alpha-45)] bg-[var(--ozer-coral-600)] text-[var(--ozer-white)]'
              : isLight
                ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]'
                : 'border-[color:var(--ozer-coral-alpha-45)] bg-[var(--ozer-plum-800)] text-[var(--ozer-accent)]',
          )}
          aria-label={assistant.addonTooltip}
        >
          {isAddon ? (
            <Plus className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
          ) : (
            <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className={cn(
          'max-w-[220px] border border-[color:var(--workspace-shell-border)] text-xs',
          isLight
            ? 'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]'
            : 'bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]',
        )}
      >
        {assistant.addonTooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function AssistantLayerCard({
  assistant,
  compact = false,
  tone = 'dark',
}: {
  assistant: PersonalAssistantMarketing;
  compact?: boolean;
  tone?: PricingTone;
}) {
  const Icon = assistant.icon;
  const isLight = tone === 'light';

  return (
    <div
      className={cn(
        'relative z-10 rounded-lg border border-l-2 border-l-[var(--ozer-accent)]/50 text-center',
        isLight
          ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_4px_16px_var(--ozer-plum-alpha-08)]'
          : 'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-900)] shadow-[0_4px_16px_var(--ozer-plum-alpha-18)]',
        compact
          ? 'w-full px-1.5 py-2'
          : 'w-[96px] px-2 py-2 sm:w-[118px] sm:px-2.5 sm:py-2.5 lg:w-[132px]',
      )}
    >
      <span
        className={cn(
          'relative mx-auto flex items-center justify-center rounded-md bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
      >
        <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden />
        <AssistantBillingBadge assistant={assistant} tone={tone} />
      </span>
      <p
        className={cn(
          'font-semibold leading-tight',
          isLight ? 'text-[var(--workspace-shell-text)]' : 'text-[var(--ozer-text-on-dark)]',
          compact ? 'mt-1.5 text-[9px]' : 'mt-2 text-[11px]',
        )}
      >
        {assistant.label}
      </p>
      {!compact ? (
        <p
          className={cn(
            'mt-1.5 text-[9px] leading-snug sm:mt-1.5 sm:text-[10px]',
            isLight
              ? 'text-[var(--workspace-shell-text-muted)]'
              : 'text-[var(--ozer-text-on-dark-muted)]',
          )}
        >
          {assistant.description}
        </p>
      ) : null}
    </div>
  );
}

function PersonalHomeCard({
  className,
  flashing,
  compact = false,
  tone = 'dark',
}: {
  className?: string;
  flashing: boolean;
  compact?: boolean;
  tone?: PricingTone;
}) {
  const isLight = tone === 'light';

  return (
    <div
      className={cn(
        'relative z-20 rounded-xl border-2 text-center transition-[border-color,box-shadow] duration-200',
        isLight
          ? 'bg-[var(--workspace-shell-panel)]'
          : 'bg-[var(--ozer-plum-900)]',
        compact
          ? 'w-[118px] px-3 py-3'
          : 'w-[118px] px-3 py-3 sm:w-[140px] sm:px-4 sm:py-4 lg:w-[160px] lg:scale-110',
        flashing
          ? 'border-[var(--ozer-coral-100)] shadow-[0_0_30px_var(--ozer-coral-alpha-45)]'
          : 'border-[var(--ozer-accent)] shadow-[0_0_18px_var(--ozer-coral-alpha-15)]',
        className,
      )}
    >
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--ozer-coral-alpha-45)] bg-[var(--ozer-accent-subtle)]">
        <Home className="h-4 w-4 text-[var(--ozer-accent)]" aria-hidden />
      </span>
      <p
        className={cn(
          'mt-2 text-sm font-bold',
          isLight ? 'text-[var(--workspace-shell-text)]' : 'text-[var(--ozer-text-on-dark)]',
        )}
      >
        Personal Home
      </p>
      <p
        className={cn(
          'mt-0.5 text-[10px]',
          isLight ? 'text-[var(--workspace-shell-text-muted)]' : 'text-[var(--ozer-text-on-dark-muted)]',
        )}
      >
        Your command centre
      </p>
    </div>
  );
}

function MobileWorkspaceDiagram({
  business,
  family,
  community,
  hubFlashing,
  tone = 'dark',
}: {
  business: InterconnectedWorkspaceNode | undefined;
  family: InterconnectedWorkspaceNode | undefined;
  community: InterconnectedWorkspaceNode | undefined;
  hubFlashing: boolean;
  tone?: PricingTone;
}) {
  return (
    <div className="flex w-full flex-col gap-4 py-2">
      <div className="grid grid-cols-3 gap-2">
        {business ? (
          <OrbitWorkspaceCard
            compact
            node={{ ...business, orbitId: 'business' }}
          />
        ) : (
          <div />
        )}
        {family ? (
          <OrbitWorkspaceCard compact node={{ ...family, orbitId: 'family' }} />
        ) : (
          <div />
        )}
        {community ? (
          <OrbitWorkspaceCard
            compact
            node={{ ...community, orbitId: 'community' }}
          />
        ) : (
          <div />
        )}
      </div>

      <div className="flex justify-center py-1">
        <PersonalHomeCard compact flashing={hubFlashing} tone={tone} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PERSONAL_ASSISTANTS_MARKETING.map((assistant) => (
          <AssistantLayerCard key={assistant.id} compact assistant={assistant} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function DesktopWorkspaceDiagram({
  business,
  family,
  community,
  hubFlashing,
  tone = 'dark',
}: {
  business: InterconnectedWorkspaceNode | undefined;
  family: InterconnectedWorkspaceNode | undefined;
  community: InterconnectedWorkspaceNode | undefined;
  hubFlashing: boolean;
  tone?: PricingTone;
}) {
  return (
    <div
      className="relative mx-auto aspect-[5/4] min-h-[360px] w-full max-w-[690px] md:min-h-[440px]"
      aria-hidden
    >
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <CircuitPaths paths={ASSISTANT_CIRCUIT_PATHS} />
        <CircuitPaths paths={OUTER_CIRCUIT_PATHS} />
      </svg>

      <div className="absolute left-0 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5 pl-0 sm:gap-2">
        {PERSONAL_ASSISTANTS_MARKETING.map((assistant) => (
          <AssistantLayerCard key={assistant.id} assistant={assistant} tone={tone} />
        ))}
      </div>

      <div className="absolute left-1/2 top-[5%] z-10 -translate-x-1/2">
        {business ? (
          <OrbitWorkspaceCard node={{ ...business, orbitId: 'business' }} />
        ) : null}
      </div>

      <div className="absolute right-[1%] top-1/2 z-10 -translate-y-1/2 sm:right-[3%]">
        {family ? (
          <OrbitWorkspaceCard node={{ ...family, orbitId: 'family' }} />
        ) : null}
      </div>

      <div className="absolute bottom-[5%] left-1/2 z-10 -translate-x-1/2">
        {community ? (
          <OrbitWorkspaceCard node={{ ...community, orbitId: 'community' }} />
        ) : null}
      </div>

      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <PersonalHomeCard flashing={hubFlashing} tone={tone} />
      </div>
    </div>
  );
}

export function WorkspaceOrbitDiagram({
  nodes,
  tone = 'dark',
}: {
  nodes: readonly InterconnectedWorkspaceNode[];
  tone?: PricingTone;
}) {
  const hubFlashing = useHubBorderPulse(ALL_DOT_BEGINS, DOT_DURATION_S);
  const business = nodes.find((node) => node.id === 'work');
  const family = nodes.find((node) => node.id === 'family');
  const community = nodes.find((node) => node.id === 'community');

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full">
        <div className="md:hidden">
          <MobileWorkspaceDiagram
            business={business}
            family={family}
            community={community}
            hubFlashing={hubFlashing}
            tone={tone}
          />
        </div>

        <div className="hidden md:block">
          <DesktopWorkspaceDiagram
            business={business}
            family={family}
            community={community}
            hubFlashing={hubFlashing}
            tone={tone}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
