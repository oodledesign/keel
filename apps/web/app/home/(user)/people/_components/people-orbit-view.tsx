'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { CIRCLE_TIER_ORDER, getCircleTierMeta } from '../_lib/circle-tiers';
import type { PersonCircleTier } from '../_lib/schema/people.schema';
import type { PersonListItem } from '../_lib/server/people.service';
import { CircleTierBadge } from './circle-tier-badge';
import { PersonAvatar } from './person-avatar';

type PeopleViewer = {
  name: string;
  avatarUrl: string | null;
};

type PeopleOrbitViewProps = {
  people: PersonListItem[];
  viewer: PeopleViewer;
  className?: string;
};

type RingLayout = {
  tier: PersonCircleTier;
  radiusPercent: number;
  avatarSize: 'xs' | 'sm' | 'md' | 'lg';
  people: PersonListItem[];
};

const BASE_RING_RADIUS_PERCENT: Record<PersonCircleTier, number> = {
  core: 24,
  close: 40,
  friends: 56,
  community: 72,
};

const RING_AVATAR_SIZE: Record<PersonCircleTier, RingLayout['avatarSize']> = {
  core: 'lg',
  close: 'md',
  friends: 'sm',
  community: 'xs',
};

const RING_STROKE: Record<PersonCircleTier, string> = {
  core: 'stroke-[var(--ozer-accent)]/35',
  close: 'stroke-[#2563EB]/30',
  friends: 'stroke-violet-400/25',
  community: 'stroke-white/15',
};

function displayName(person: PersonListItem) {
  return person.nickname?.trim() || person.full_name;
}

function effectiveRadiusPercent(tier: PersonCircleTier, count: number) {
  const base = BASE_RING_RADIUS_PERCENT[tier];
  if (count <= 6) return base;
  return Math.min(
    tier === 'community' ? 46 : base + 4,
    base + (count - 6) * 1.5,
  );
}

function positionOnRing(index: number, total: number, radiusPercent: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: radiusPercent * Math.cos(angle),
    y: radiusPercent * Math.sin(angle),
  };
}

export function PeopleOrbitView({
  people,
  viewer,
  className,
}: PeopleOrbitViewProps) {
  const rings = useMemo(() => {
    const layout: RingLayout[] = [];

    for (const tier of CIRCLE_TIER_ORDER) {
      const tierPeople = people
        .filter((person) => person.circle_tier === tier)
        .sort((a, b) => displayName(a).localeCompare(displayName(b)));

      if (tierPeople.length === 0) continue;

      layout.push({
        tier,
        people: tierPeople,
        avatarSize: RING_AVATAR_SIZE[tier],
        radiusPercent: effectiveRadiusPercent(tier, tierPeople.length),
      });
    }

    return layout;
  }, [people]);

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)]',
          'bg-[radial-gradient(circle_at_center,rgba(255, 92, 52, 0.08),transparent_55%),var(--workspace-shell-panel)]',
        )}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {rings.map((ring) => (
            <circle
              key={ring.tier}
              cx={50}
              cy={50}
              r={ring.radiusPercent}
              fill="none"
              className={RING_STROKE[ring.tier]}
              strokeWidth={0.35}
              strokeDasharray="1.2 1.8"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <div
          className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center"
          aria-label="You"
        >
          <PersonAvatar
            name={viewer.name}
            avatarUrl={viewer.avatarUrl}
            size="xl"
            className="mx-auto shadow-[0_0_0_4px_rgba(42,157,143,0.2)]"
          />
          <p className="mt-2 hidden text-xs font-medium text-[var(--workspace-shell-text)] sm:block">
            {viewer.name}
          </p>
          <p className="hidden text-[10px] tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase sm:block">
            You
          </p>
        </div>

        {rings.map((ring) =>
          ring.people.map((person, index) => {
            const { x, y } = positionOnRing(
              index,
              ring.people.length,
              ring.radiusPercent,
            );
            const name = displayName(person);
            const href = `${pathsConfig.app.personalPeople}/${person.id}`;

            return (
              <Link
                key={person.id}
                href={href}
                className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
                style={{
                  left: `calc(50% + ${x}%)`,
                  top: `calc(50% + ${y}%)`,
                }}
                aria-label={name}
              >
                <PersonAvatar
                  name={name}
                  avatarUrl={person.avatar_url}
                  size={ring.avatarSize}
                  tier={ring.tier}
                  className="transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110"
                />
                <span
                  className={cn(
                    'pointer-events-none absolute top-full left-1/2 z-30 mt-2 -translate-x-1/2',
                    'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/95 px-2.5 py-1 whitespace-nowrap',
                    'text-xs font-medium text-[var(--workspace-shell-text)] shadow-lg backdrop-blur-sm',
                    'opacity-0 transition-opacity duration-150',
                    'group-hover:opacity-100 group-focus-visible:opacity-100',
                  )}
                >
                  {name}
                </span>
              </Link>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--workspace-shell-text-muted)]">
        {rings.map((ring) => (
          <span key={ring.tier} className="inline-flex items-center gap-1.5">
            <CircleTierBadge tier={ring.tier} />
            <span>
              {getCircleTierMeta(ring.tier).label} ({ring.people.length})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
