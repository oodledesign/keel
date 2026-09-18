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
import {
  workspaceBtnPrimaryMd,
  workspaceCardHover,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { upsertFamilyChildAction } from '../_lib/server/family-memories-actions';
import type { FamilyMemoriesPageData } from '../_lib/server/family-memories.loader';
import { ChildAvatar } from './child-avatar';

export function ChildrenIndexClient({
  data,
}: {
  data: FamilyMemoriesPageData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [markId, setMarkId] = useState('');

  const unmarked = data.people.filter((person) => !person.is_child);
  const childHref = (personId: string) =>
    pathsConfig.app.accountMemoryChild
      .replace('[account]', data.accountSlug)
      .replace('[personId]', personId);

  function addChild() {
    const displayName = name.trim();
    if (!displayName) return;

    startTransition(async () => {
      try {
        await upsertFamilyChildAction({
          accountSlug: data.accountSlug,
          displayName,
          dateOfBirth: dateOfBirth || null,
          isChild: true,
        });
        setName('');
        setDateOfBirth('');
        toast.success('Child added as a Person');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add child',
        );
      }
    });
  }

  function markExisting() {
    const person = unmarked.find((item) => item.id === markId);
    if (!person) return;

    startTransition(async () => {
      try {
        await upsertFamilyChildAction({
          accountSlug: data.accountSlug,
          id: person.id,
          displayName: person.display_name,
          isChild: true,
        });
        setMarkId('');
        toast.success(`${person.display_name} is now on Children`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update person',
        );
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 lg:px-6">
      {data.children.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.children.map((child) => (
            <Link
              key={child.id}
              href={childHref(child.id)}
              className={`${workspacePanelCard} ${workspaceCardHover} flex items-center gap-3 p-4`}
            >
              <ChildAvatar
                name={child.display_name}
                url={child.avatarUrl}
                size="lg"
              />
              <div className="min-w-0">
                <p className="font-heading truncate text-lg font-semibold">
                  {child.display_name}
                </p>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  {child.ageLabel ?? 'Add a birthday'}
                  {' · '}
                  {child.memoryCount === 1
                    ? '1 memory'
                    : `${child.memoryCount} memories`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={`${workspacePanelCard} px-6 py-10 text-center`}>
          <p className="font-heading text-xl font-semibold">Add the kids</p>
          <p className={`mx-auto mt-2 max-w-sm text-sm ${workspaceTextMuted}`}>
            Each child is a Person in this family workspace. Memories attach to
            that Person — no second household profile.
          </p>
        </div>
      )}

      <div className={`${workspacePanelCard} space-y-4 p-5`}>
        <h2 className="text-sm font-semibold">Add a child</h2>
        <p className={`text-xs ${workspaceTextMuted}`}>
          Creates a People record marked as a child. Name and photo live on that
          Person.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="child-name">Name</Label>
            <Input
              id="child-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Poet"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="child-dob">Birthday (optional)</Label>
            <Input
              id="child-dob"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={addChild}
          disabled={isPending}
        >
          <Plus className="h-4 w-4" />
          Add child
        </Button>
      </div>

      {unmarked.length > 0 ? (
        <div className={`${workspacePanelCard} space-y-3 p-5`}>
          <h2 className="text-sm font-semibold">Already in People</h2>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Mark an existing Person as a child. Meal-plan household stays
            separate.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={markId}
              onChange={(event) => setMarkId(event.target.value)}
              className="h-9 flex-1 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-3 text-sm"
            >
              <option value="">Choose someone</option>
              {unmarked.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={markExisting}
              disabled={!markId || isPending}
            >
              Mark as child
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
