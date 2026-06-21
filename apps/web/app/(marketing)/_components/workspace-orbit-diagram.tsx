import { Briefcase, Home, Users } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { InterconnectedWorkspaceNode } from '~/lib/marketing/interconnected-workspaces';

const OUTER_NODE_ICONS: Record<string, typeof Home> = {
  work: Briefcase,
  property: Home,
  community: Users,
};

type OrbitNode = InterconnectedWorkspaceNode & {
  orbitId: 'business' | 'property' | 'community';
};

const CIRCUIT_PATHS = [
  {
    id: 'business',
    d: 'M 50 14 L 50 34 L 40 34 L 40 50 L 50 50',
    dotBegin: ['0s', '1.25s'],
  },
  {
    id: 'property',
    d: 'M 86 50 L 58 50 L 58 42 L 50 42 L 50 50',
    dotBegin: ['0.8s', '2.05s'],
  },
  {
    id: 'community',
    d: 'M 50 86 L 50 58 L 60 58 L 60 50 L 50 50',
    dotBegin: ['1.6s', '2.85s'],
  },
] as const;

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
      className="relative mx-auto aspect-square min-h-[420px] w-full max-w-[520px] rounded-2xl bg-[#0d0b1e]/60"
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
        {CIRCUIT_PATHS.map((path) => (
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
                r="3"
                fill="#2dd4bf"
                style={{ filter: 'drop-shadow(0 0 4px #2dd4bf)' }}
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
      </svg>

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
