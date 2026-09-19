'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Heart, Plus, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspaceFilterActive,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  MEMORY_KINDS,
  MEMORY_KIND_LABELS,
  type MemoryKind,
  formatMemoryDay,
  isMemoryKind,
} from '../_lib/memory-constants';
import type {
  FamilyMemoriesPageData,
  FamilyMemoryItem,
} from '../_lib/server/family-memories.loader';
import { ChildAvatar } from './child-avatar';
import { MemoryCard } from './memory-card';
import { QuickMemorySheet } from './quick-memory-sheet';

function groupByDay(memories: FamilyMemoryItem[]) {
  const groups: Array<{ day: string; items: FamilyMemoryItem[] }> = [];
  const index = new Map<string, FamilyMemoryItem[]>();

  for (const memory of memories) {
    const existing = index.get(memory.occurredOn);
    if (existing) {
      existing.push(memory);
      continue;
    }

    const items = [memory];
    index.set(memory.occurredOn, items);
    groups.push({ day: memory.occurredOn, items });
  }

  return groups;
}

export function MemoriesPageClient({
  data,
  initialChildId,
  initialKind,
  initialCompose,
}: {
  data: FamilyMemoriesPageData;
  initialChildId?: string;
  initialKind?: MemoryKind | null;
  initialCompose?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialCompose));

  const childId = initialChildId ?? searchParams.get('child') ?? undefined;
  const kindParam = initialKind ?? searchParams.get('kind');
  const kind = kindParam && isMemoryKind(kindParam) ? kindParam : null;

  const pickerMembers = data.children;

  const filtered = useMemo(() => {
    return data.memories.filter((memory) => {
      if (childId && !memory.childIds.includes(childId)) return false;
      if (kind && memory.kind !== kind) return false;
      return true;
    });
  }, [childId, data.memories, kind]);

  const groups = groupByDay(filtered);

  function updateFilter(next: { child?: string | null; kind?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextChild = next.child === undefined ? childId : next.child;
    const nextKind = next.kind === undefined ? kind : next.kind;

    if (nextChild) params.set('child', nextChild);
    else params.delete('child');

    if (nextKind) params.set('kind', nextKind);
    else params.delete('kind');

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const childrenHref = pathsConfig.app.accountMemoryChildren.replace(
    '[account]',
    data.accountSlug,
  );
  const noteHref = (noteId: string) =>
    pathsConfig.app.accountNoteDetail
      .replace('[account]', data.accountSlug)
      .replace('[noteId]', noteId);
  const childHref = (personId: string) =>
    pathsConfig.app.accountMemoryChild
      .replace('[account]', data.accountSlug)
      .replace('[personId]', personId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={childrenHref}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
        >
          <Users className="h-4 w-4" />
          Children
        </Link>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          data-test="quick-memory"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Quick memory
        </Button>
      </div>

      <div className="space-y-2">
        <p className={`text-xs font-medium ${workspaceTextMuted}`}>Child</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilter({ child: null })}
            className={`rounded-full border px-3 py-1 text-xs ${
              !childId
                ? `${workspaceFilterActive} border-transparent`
                : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
            }`}
          >
            All
          </button>
          {pickerMembers.map((member) => {
            const active = childId === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() =>
                  updateFilter({ child: active ? null : member.id })
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  active
                    ? `${workspaceFilterActive} border-transparent`
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
                }`}
              >
                <ChildAvatar
                  name={member.display_name}
                  url={member.avatarUrl}
                  size="sm"
                />
                {member.display_name}
                {member.ageLabel ? ` · ${member.ageLabel}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className={`text-xs font-medium ${workspaceTextMuted}`}>Category</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => updateFilter({ kind: null })}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              !kind
                ? `${workspaceFilterActive} border-transparent`
                : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
            }`}
          >
            All
          </button>
          {MEMORY_KINDS.map((value) => {
            const active = kind === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => updateFilter({ kind: active ? null : value })}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  active
                    ? `${workspaceFilterActive} border-transparent`
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
                }`}
              >
                {MEMORY_KIND_LABELS[value]}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className={`${workspacePanelCard} px-6 py-12 text-center`}>
          <Heart className="mx-auto h-8 w-8 text-[var(--ozer-accent)]" />
          <h2 className="font-heading mt-3 text-xl font-semibold">
            No memories yet
          </h2>
          <p className={`mx-auto mt-2 max-w-sm text-sm ${workspaceTextMuted}`}>
            Capture the funny thing they just said, a first, or an ordinary
            Tuesday. It takes a few seconds.
          </p>
          <Button
            type="button"
            className={`${workspaceBtnPrimaryMd} mt-5`}
            data-test="quick-memory-empty"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Quick memory
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.day} className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                {formatMemoryDay(group.day)}
              </h2>
              <div className="space-y-4">
                {group.items.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    noteHref={noteHref(memory.id)}
                    childHref={childHref}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <QuickMemorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accountId={data.accountId}
        accountSlug={data.accountSlug}
        people={data.people}
        defaultChildIds={childId ? [childId] : []}
      />
    </div>
  );
}
