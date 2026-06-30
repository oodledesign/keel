'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Cake,
  CalendarClock,
  LayoutGrid,
  Orbit,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import type { PersonListItem } from '../_lib/server/people.service';
import {
  CIRCLE_TIER_OPTIONS,
  CIRCLE_TIER_ORDER,
  getCircleTierMeta,
} from '../_lib/circle-tiers';
import type { PersonCircleTier } from '../_lib/schema/people.schema';
import { CircleTierBadge } from './circle-tier-badge';
import { PeopleOrbitView } from './people-orbit-view';
import { PersonAvatar } from './person-avatar';
import { PersonFormDialog } from './person-form-dialog';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

type SortKey = 'recent' | 'name' | 'catchup' | 'circle';

type CircleFilter = 'all' | PersonCircleTier;

type ViewMode = 'list' | 'orbit';

type Props = {
  people: PersonListItem[];
  viewer: {
    name: string;
    avatarUrl: string | null;
  };
};

function displayName(p: PersonListItem) {
  return p.nickname?.trim() || p.full_name;
}

function formatLastMet(last: string | null) {
  if (!last) return 'Never met';
  const d = new Date(`${last}T12:00:00`);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PeoplePageClient({ people, viewer }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('orbit');
  const [sort, setSort] = useState<SortKey>('circle');
  const [circleFilter, setCircleFilter] = useState<CircleFilter>('all');
  const [showCreate, setShowCreate] = useState(
    searchParams.get('create') === 'person',
  );
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = people;

    if (q) {
      list = list.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.nickname?.toLowerCase().includes(q) ?? false) ||
          (p.relationship_label?.toLowerCase().includes(q) ?? false),
      );
    }

    if (circleFilter !== 'all') {
      list = list.filter((p) => p.circle_tier === circleFilter);
    }

    if (sort !== 'circle') {
      list = [...list].sort((a, b) => {
        if (sort === 'name') {
          return displayName(a).localeCompare(displayName(b));
        }
        if (sort === 'catchup') {
          if (a.catchupOverdue !== b.catchupOverdue) {
            return a.catchupOverdue ? -1 : 1;
          }
          return displayName(a).localeCompare(displayName(b));
        }
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    }

    return list;
  }, [people, search, sort, circleFilter]);

  const groupedByCircle = useMemo(() => {
    if (sort !== 'circle') return null;

    return CIRCLE_TIER_ORDER.map((tier) => ({
      tier,
      meta: getCircleTierMeta(tier),
      people: filtered
        .filter((person) => person.circle_tier === tier)
        .sort((a, b) => displayName(a).localeCompare(displayName(b))),
    })).filter((group) => group.people.length > 0);
  }, [filtered, sort]);

  const onCreated = (id: string) => {
    startTransition(() => {
      router.push(`${pathsConfig.app.personalPeople}/${id}`);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-12 pt-2 text-[var(--workspace-shell-text)] md:px-0">
      <div className="flex flex-col gap-4 border-b border-[color:var(--workspace-shell-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            People
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--workspace-shell-text-muted)]">
            Stay close to the people who matter — organise your circle of trust,
            track dates, gift ideas, and catchups.
          </p>
        </div>
        <Button
          className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add person
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
          <Input
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] pl-9 text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            placeholder="Search by name or relationship…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={circleFilter} onValueChange={(v) => setCircleFilter(v as CircleFilter)}>
          <SelectTrigger className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:w-[170px]">
            <SelectValue placeholder="Circle" />
          </SelectTrigger>
          <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
            <SelectItem value="all">All circles</SelectItem>
            {CIRCLE_TIER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {viewMode === 'list' ? (
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
              <SelectItem value="circle">By circle</SelectItem>
              <SelectItem value="recent">Recently updated</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="catchup">Needs catchup</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1">
          <button
            type="button"
            onClick={() => setViewMode('orbit')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition',
              viewMode === 'orbit'
                ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
            aria-pressed={viewMode === 'orbit'}
          >
            <Orbit className="h-4 w-4" />
            Orbit
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition',
              viewMode === 'list'
                ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
            aria-pressed={viewMode === 'list'}
          >
            <LayoutGrid className="h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className={cn(
            panelClass,
            'flex flex-col items-center justify-center px-6 py-16 text-center',
          )}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]">
            <UserRound className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-medium text-[var(--workspace-shell-text)]">
            {people.length === 0
              ? 'Add someone you want to stay close to'
              : 'No matches'}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-[var(--workspace-shell-text-muted)]">
            {people.length === 0
              ? 'Track birthdays, gift ideas, and what you talked about last time you met.'
              : 'Try a different search term.'}
          </p>
          {people.length === 0 && (
            <Button
              className="mt-6 bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add your first person
            </Button>
          )}
        </div>
      ) : viewMode === 'orbit' ? (
        <PeopleOrbitView people={filtered} viewer={viewer} />
      ) : groupedByCircle ? (
        <div className="space-y-8">
          {groupedByCircle.map((group) => (
            <section key={group.tier}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <CircleTierBadge tier={group.tier} showFullLabel />
                <span className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {group.meta.description}
                </span>
                <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                  ({group.people.length})
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.people.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}

      <PersonFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSaved={onCreated}
      />
    </div>
  );
}

function PersonCard({ person }: { person: PersonListItem }) {
  const href = `${pathsConfig.app.personalPeople}/${person.id}`;
  const name = displayName(person);

  return (
    <Link
      href={href}
      className={cn(
        panelClass,
        'group block p-5 transition-colors hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      <div className="flex items-start gap-3">
        <PersonAvatar
          name={name}
          avatarUrl={person.avatar_url}
          tier={person.circle_tier}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-[var(--workspace-shell-text)] group-hover:text-[var(--ozer-accent-muted)]">
              {name}
            </h3>
            <CircleTierBadge tier={person.circle_tier} />
            {person.relationship_label && (
              <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                {person.relationship_label}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Last met {formatLastMet(person.last_catchup_on)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {person.catchupOverdue && (
              <Badge icon={CalendarClock} tone="amber">
                Catch up due
              </Badge>
            )}
            {person.birthdayThisWeek && person.daysUntilBirthday !== null && (
              <Badge icon={Cake} tone="teal">
                {person.daysUntilBirthday === 0
                  ? 'Birthday today'
                  : `Birthday in ${person.daysUntilBirthday}d`}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Badge({
  children,
  icon: Icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'amber' | 'teal';
}) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-500/10 text-amber-300'
      : 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}
