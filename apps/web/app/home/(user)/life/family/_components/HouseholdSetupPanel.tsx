'use client';

import { useState, useTransition } from 'react';

import { Plus, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  deleteHouseholdMemberAction,
  deletePantryItemAction,
  upsertHouseholdMemberAction,
  upsertPantryItemAction,
} from '../_lib/household-actions';
import type {
  HouseholdMemberRow,
  PantryItemRow,
} from '../_lib/schema/family-meal.schema';
import { dietaryChoices, panelClass } from './meal-ui';

type Props = {
  members: HouseholdMemberRow[];
  pantry: PantryItemRow[];
  accountSlug?: string;
  onSaved: () => void;
};

export function HouseholdSetupPanel({
  members,
  pantry,
  accountSlug,
  onSaved,
}: Props) {
  const scopeFields = accountSlug ? { accountSlug } : {};
  const [name, setName] = useState('');
  const [pantryName, setPantryName] = useState('');
  const [isPending, startTransition] = useTransition();

  function addMember() {
    const displayName = name.trim();
    if (!displayName) return;
    startTransition(async () => {
      const result = await upsertHouseholdMemberAction({
        displayName,
        dietaryTags: [],
        excludedIngredients: [],
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setName('');
      onSaved();
    });
  }

  function toggleMemberDiet(member: HouseholdMemberRow, tag: string) {
    const dietaryTags = member.dietary_tags.includes(tag)
      ? member.dietary_tags.filter((value) => value !== tag)
      : [...member.dietary_tags, tag];
    startTransition(async () => {
      const result = await upsertHouseholdMemberAction({
        id: member.id,
        displayName: member.display_name,
        dietaryTags,
        excludedIngredients: member.excluded_ingredients,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved();
    });
  }

  function removeMember(memberId: string) {
    startTransition(async () => {
      const result = await deleteHouseholdMemberAction({
        memberId,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved();
    });
  }

  function addPantry() {
    const value = pantryName.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await upsertPantryItemAction({
        name: value,
        ...scopeFields,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPantryName('');
      onSaved();
    });
  }

  function removePantry(itemId: string) {
    startTransition(async () => {
      const result = await deletePantryItemAction({ itemId, ...scopeFields });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="space-y-5">
      <div className={`${panelClass} p-5`}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Who cooks
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Assign nights on the meal plan. Dietary tags warn when a recipe
          conflicts.
        </p>
        <div className="mt-3 space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{member.display_name}</p>
                <button
                  type="button"
                  onClick={() => removeMember(member.id)}
                  aria-label={`Remove ${member.display_name}`}
                  className="text-[var(--workspace-shell-text-muted)] hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dietaryChoices.map((tag) => {
                  const active = member.dietary_tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleMemberDiet(member, tag)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${
                        active
                          ? 'border-transparent bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                          : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addMember();
              }
            }}
            placeholder="e.g. Dan"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addMember}
            disabled={isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className={`${panelClass} p-5`}>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Pantry / we have this
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Matching shopping items are dimmed when you generate a list.
        </p>
        {pantry.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pantry.map((item) => (
              <span
                key={item.id}
                className="flex items-center gap-1 rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1 text-xs"
              >
                {item.name}
                <button
                  type="button"
                  onClick={() => removePantry(item.id)}
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="h-3 w-3 text-[var(--workspace-shell-text-muted)]" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Input
            value={pantryName}
            onChange={(event) => setPantryName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addPantry();
              }
            }}
            placeholder="e.g. olive oil"
            className="h-9 text-sm"
          />
          <Button type="button" variant="outline" onClick={addPantry}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
