'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Cake,
  CalendarClock,
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
import { PersonFormDialog } from './person-form-dialog';

const panelClass =
  'rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)]';

type SortKey = 'recent' | 'name' | 'catchup';

type Props = {
  people: PersonListItem[];
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

export function PeoplePageClient({ people }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
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

    return list;
  }, [people, search, sort]);

  const onCreated = (id: string) => {
    startTransition(() => {
      router.push(`${pathsConfig.app.personalPeople}/${id}`);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-12 pt-2 text-white md:px-0">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            People
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Stay close to the people who matter — notes, dates, gift ideas, and
            memories in one place.
          </p>
        </div>
        <Button
          className="bg-[var(--keel-teal)] hover:bg-[#238b7f]"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add person
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="border-white/10 bg-[var(--workspace-shell-panel)] pl-9 text-white placeholder:text-zinc-500"
            placeholder="Search by name or relationship…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full border-white/10 bg-[var(--workspace-shell-panel)] text-white sm:w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#0F1B35] text-white">
            <SelectItem value="recent">Recently updated</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="catchup">Needs catchup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div
          className={cn(
            panelClass,
            'flex flex-col items-center justify-center px-6 py-16 text-center',
          )}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--keel-teal)]/15 text-[#5eead4]">
            <UserRound className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-medium text-white">
            {people.length === 0
              ? 'Add someone you want to stay close to'
              : 'No matches'}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-400">
            {people.length === 0
              ? 'Track birthdays, gift ideas, and what you talked about last time you met.'
              : 'Try a different search term.'}
          </p>
          {people.length === 0 && (
            <Button
              className="mt-6 bg-[var(--keel-teal)] hover:bg-[#238b7f]"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add your first person
            </Button>
          )}
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
        'group block p-5 transition-colors hover:border-white/15 hover:bg-white/[0.02]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--keel-teal)]/15 text-lg font-semibold text-[#5eead4]">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white group-hover:text-[#5eead4]">
              {name}
            </h3>
            {person.relationship_label && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                {person.relationship_label}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
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
      : 'bg-[var(--keel-teal)]/10 text-[#5eead4]';

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
