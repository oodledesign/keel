import { Briefcase, CalendarDays, Home, Mail, Mic, Users } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { InterconnectedWorkspaceNode } from '~/lib/marketing/interconnected-workspaces';

const OUTER_NODE_ICONS: Record<string, typeof Home> = {
  work: Briefcase,
  property: Home,
  community: Users,
};

const ASSISTANT_NODES = [
  {
    id: 'email',
    label: 'Email Assistant',
    caption: 'Gmail sync & drafts',
    icon: Mail,
    top: '22%',
  },
  {
    id: 'meeting',
    label: 'Meeting Assistant',
    caption: 'Record & transcribe',
    icon: Mic,
    top: '50%',
  },
  {
    id: 'planner',
    label: 'AI Planner',
    caption: 'Today & day planning',
    icon: CalendarDays,
    top: '78%',
  },
] as const;

type OrbitNode = InterconnectedWorkspaceNode & {
  orbitId: 'business' | 'property' | 'community';
};

const HUB_X = 50;
const HUB_Y = 50;

const OUTER_CIRCUIT_PATHS = [
  {
    id: 'business',
    d: `M ${HUB_X} 14 L ${HUB_X} 34 L 40 34 L 40 ${HUB_Y} L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['0s', '1.25s'],
  },
  {
    id: 'property',
    d: `M 86 ${HUB_Y} L 58 ${HUB_Y} L 58 42 L ${HUB_X} 42 L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['0.8s', '2.05s'],
  },
  {
    id: 'community',
    d: `M ${HUB_X} 86 L ${HUB_X} 58 L 60 58 L 60 ${HUB_Y} L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['1.6s', '2.85s'],
  },
] as const;

const ASSISTANT_CIRCUIT_PATHS = [
  {
    id: 'email',
    d: `M 14 22 L 32 22 L 32 44 L ${HUB_X} 44 L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['0.2s', '1.45s'],
  },
  {
    id: 'meeting',
    d: `M 14 ${HUB_Y} L 40 ${HUB_Y} L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['0.6s', '1.85s'],
  },
  {
    id: 'planner',
    d: `M 14 78 L 32 78 L 32 56 L ${HUB_X} 56 L ${HUB_X} ${HUB_Y}`,
    dotBegin: ['1s', '2.25s'],
  },
] as const;

function CircuitPaths({ paths }: { paths: readonly { id: string; d: string; dotBegin: readonly string[] }[] }) {
  return (
    <>
      {paths.map((path) => (
        <g key={path.id}>
          <path
            d={path.d}
            fill="none"
            stroke="rgba(45,212,191,0.2)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {path.dotBegin.map((begin) => (
            <circle
              key={`${path.id}-${begin}`}
              r="1"
              fill="#2dd4bf"
              style={{ filter: 'drop-shadow(0 0 1.5px #2dd4bf)' }}
            >
              <animateMotion
                dur="2.5s"
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
}: {
  node: OrbitNode;
  className?: string;
}) {
  const Icon = OUTER_NODE_ICONS[node.id] ?? Briefcase;

  return (
    <div
      className={cn(
        'w-[140px] rounded-xl border border-white/10 bg-[#0F1B35]/90 px-3 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm',
        className,
      )}
    >
      <span
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/10"
        style={{ backgroundColor: `${node.color}22` }}
      >
        <Icon className="h-4 w-4" style={{ color: node.color }} aria-hidden />
      </span>
      <p className="mt-2 text-sm font-bold text-white">{node.label}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-violet-100/60">
        {node.examples}
      </p>
    </div>
  );
}

function AssistantLayerCard({
  label,
  caption,
  icon: Icon,
}: {
  label: string;
  caption: string;
  icon: typeof Mail;
}) {
  return (
    <div className="w-[128px] rounded-lg border border-violet-400/20 border-l-2 border-l-violet-400/60 bg-[#120f24]/90 px-2.5 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 text-left">
          <p className="truncate text-[11px] font-semibold text-white">{label}</p>
          <p className="truncate text-[9px] text-violet-200/55">{caption}</p>
        </div>
      </div>
    </div>
  );
}

function PersonalHomeCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-[160px] scale-110 rounded-xl border border-[#2dd4bf] bg-[linear-gradient(145deg,rgba(42,157,143,0.18),rgba(11,19,43,0.95))] px-4 py-4 text-center shadow-[0_0_20px_rgba(45,212,191,0.25)]',
        className,
      )}
    >
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[#2dd4bf]/30 bg-[#2dd4bf]/10">
        <Home className="h-4 w-4 text-[#2dd4bf]" aria-hidden />
      </span>
      <p className="mt-2 text-sm font-bold text-white">Personal Home</p>
      <p className="mt-0.5 text-[10px] text-violet-100/70">Your command centre</p>
    </div>
  );
}

export function WorkspaceOrbitDiagram({
  nodes,
}: {
  nodes: readonly InterconnectedWorkspaceNode[];
}) {
  const business = nodes.find((node) => node.id === 'work');
  const property = nodes.find((node) => node.id === 'property');
  const community = nodes.find((node) => node.id === 'community');

  return (
    <div
      className="relative mx-auto aspect-[5/4] min-h-[420px] w-full max-w-[600px] rounded-2xl bg-[#0d0b1e]/60"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      aria-hidden
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <CircuitPaths paths={ASSISTANT_CIRCUIT_PATHS} />
        <CircuitPaths paths={OUTER_CIRCUIT_PATHS} />
      </svg>

      <div className="absolute left-[2%] top-1/2 -translate-y-1/2 space-y-3">
        {ASSISTANT_NODES.map((assistant) => (
          <AssistantLayerCard
            key={assistant.id}
            label={assistant.label}
            caption={assistant.caption}
            icon={assistant.icon}
          />
        ))}
      </div>

      <div className="absolute left-1/2 top-[5%] -translate-x-1/2">
        {business ? (
          <OrbitWorkspaceCard node={{ ...business, orbitId: 'business' }} />
        ) : null}
      </div>

      <div className="absolute right-[3%] top-1/2 -translate-y-1/2">
        {property ? (
          <OrbitWorkspaceCard node={{ ...property, orbitId: 'property' }} />
        ) : null}
      </div>

      <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2">
        {community ? (
          <OrbitWorkspaceCard node={{ ...community, orbitId: 'community' }} />
        ) : null}
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <PersonalHomeCard />
      </div>
    </div>
  );
}
