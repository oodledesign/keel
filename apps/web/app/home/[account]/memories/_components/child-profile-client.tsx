'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { PersonImageUploader } from '~/home/(user)/people/_components/person-image-uploader';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { formatMemoryDay } from '../_lib/memory-constants';
import { upsertFamilyChildAction } from '../_lib/server/family-memories-actions';
import type {
  FamilyMemoryChild,
  FamilyMemoryItem,
} from '../_lib/server/family-memories.loader';
import { MemoryCard } from './memory-card';
import { QuickMemorySheet } from './quick-memory-sheet';

export function ChildProfileClient({
  accountId,
  accountSlug,
  child,
  people,
  memories,
}: {
  accountId: string;
  accountSlug: string;
  child: FamilyMemoryChild;
  people: FamilyMemoryChild[];
  memories: FamilyMemoryItem[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(child.display_name);
  const [dateOfBirth, setDateOfBirth] = useState(child.date_of_birth ?? '');

  const memoriesHref = pathsConfig.app.accountMemories.replace(
    '[account]',
    accountSlug,
  );
  const childrenHref = pathsConfig.app.accountMemoryChildren.replace(
    '[account]',
    accountSlug,
  );
  const noteHref = (noteId: string) =>
    pathsConfig.app.accountNoteDetail
      .replace('[account]', accountSlug)
      .replace('[noteId]', noteId);
  const childHref = (personId: string) =>
    pathsConfig.app.accountMemoryChild
      .replace('[account]', accountSlug)
      .replace('[personId]', personId);

  function saveProfile() {
    startTransition(async () => {
      try {
        await upsertFamilyChildAction({
          accountSlug,
          id: child.id,
          displayName: displayName.trim() || child.display_name,
          dateOfBirth: dateOfBirth || null,
          isChild: true,
        });
        toast.success('Person saved');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save profile',
        );
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 lg:px-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={memoriesHref}
          className="text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
        >
          Memories
        </Link>
        <span className={workspaceTextMuted}>/</span>
        <Link
          href={childrenHref}
          className="text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
        >
          Children
        </Link>
      </div>

      <section className={`${workspacePanelCard} p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <PersonImageUploader
            personId={child.id}
            personName={child.display_name}
            avatarUrl={child.avatarUrl}
            size="md"
            onUpdated={() => router.refresh()}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {child.display_name}
            </h2>
            <p className={`text-sm ${workspaceTextMuted}`}>
              {child.ageLabel ?? 'Add a birthday to show their age'}
            </p>
            <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
              This is their People profile. Memories below are tagged to this
              Person.
            </p>
          </div>
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Quick memory
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-dob">Birthday</Label>
            <Input
              id="profile-dob"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={saveProfile}
          disabled={isPending}
        >
          Save person
        </Button>
      </section>

      {memories.length === 0 ? (
        <div className={`${workspacePanelCard} px-6 py-10 text-center`}>
          <p className="font-heading text-xl font-semibold">
            No memories for {child.display_name} yet
          </p>
          <p className={`mx-auto mt-2 max-w-sm text-sm ${workspaceTextMuted}`}>
            The next funny thing they say can live here.
          </p>
          <Button
            type="button"
            className={`${workspaceBtnPrimaryMd} mt-5`}
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Quick memory
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">
            {memories.length === 1
              ? `1 memory · newest ${formatMemoryDay(memories[0]!.occurredOn)}`
              : `${memories.length} memories`}
          </h3>
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              noteHref={noteHref(memory.id)}
              childHref={childHref}
            />
          ))}
        </div>
      )}

      <QuickMemorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        people={people}
        defaultChildIds={[child.id]}
      />
    </div>
  );
}
