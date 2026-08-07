'use client';

import { useMemo, useState, useTransition } from 'react';

import { ArrowDown, ArrowUp, Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import type { RequestTypeRecord } from '~/lib/credits/request-types-types';
import {
  deleteRequestTypeAction,
  reorderRequestTypesAction,
  upsertRequestTypeAction,
} from '../_lib/server/request-types-actions';

type Draft = {
  id?: string;
  label: string;
  creditCost: string;
  isBillable: boolean;
  categoryGroup: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  label: '',
  creditCost: '1',
  isBillable: true,
  categoryGroup: '',
  isActive: true,
});

export function RequestTypesPanel({
  accountId,
  initialTypes,
  canEdit,
}: {
  accountId: string;
  initialTypes: RequestTypeRecord[];
  canEdit: boolean;
}) {
  const [types, setTypes] = useState(initialTypes);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...types].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label, 'en-GB', { sensitivity: 'base' }),
      ),
    [types],
  );

  function startCreate() {
    setDraft(emptyDraft());
  }

  function startEdit(row: RequestTypeRecord) {
    setDraft({
      id: row.id,
      label: row.label,
      creditCost: String(row.creditCost),
      isBillable: row.isBillable,
      categoryGroup: row.categoryGroup ?? '',
      isActive: row.isActive,
    });
  }

  function save() {
    if (!draft) return;
    const creditCost = Number(draft.creditCost);
    if (!Number.isFinite(creditCost) || creditCost < 0) {
      toast.error('Enter a valid credit cost');
      return;
    }
    if (!draft.label.trim()) {
      toast.error('Label is required');
      return;
    }

    const existing = draft.id
      ? types.find((row) => row.id === draft.id)
      : null;

    startTransition(async () => {
      try {
        const saved = await upsertRequestTypeAction({
          accountId,
          id: draft.id,
          label: draft.label.trim(),
          creditCost: Math.round(creditCost),
          isBillable: draft.isBillable,
          categoryGroup: draft.categoryGroup.trim() || null,
          sortOrder: existing?.sortOrder ?? 0,
          isActive: draft.isActive,
        });
        setTypes((current) => {
          const without = current.filter((row) => row.id !== saved.id);
          return [...without, saved];
        });
        setDraft(null);
        toast.success(draft.id ? 'Request type updated' : 'Request type created');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save request type',
        );
      }
    });
  }

  function archive(id: string) {
    startTransition(async () => {
      try {
        await deleteRequestTypeAction({ accountId, id });
        setTypes((current) =>
          current.map((row) =>
            row.id === id ? { ...row, isActive: false } : row,
          ),
        );
        toast.success('Request type archived');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not archive request type',
        );
      }
    });
  }

  function move(id: string, direction: -1 | 1) {
    const ordered = sorted.map((row) => row.id);
    const index = ordered.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed!);

    const byId = new Map(types.map((row) => [row.id, row]));
    setTypes(
      next.map((rowId, sortOrder) => ({
        ...byId.get(rowId)!,
        sortOrder,
      })),
    );

    startTransition(async () => {
      try {
        await reorderRequestTypesAction({ accountId, orderedIds: next });
      } catch (error) {
        setTypes(initialTypes);
        toast.error(
          error instanceof Error ? error.message : 'Could not reorder',
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Request types
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Categories clients choose when submitting work. Billable types
            deduct credits when work starts.
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || draft !== null}
            onClick={startCreate}
          >
            <Plus className="mr-1 size-4" />
            Add type
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Label</Label>
              <Input
                value={draft.label}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
                placeholder="e.g. Content update"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Credit cost</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={draft.creditCost}
                disabled={!draft.isBillable}
                onChange={(event) =>
                  setDraft({ ...draft, creditCost: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category group</Label>
              <Input
                value={draft.categoryGroup}
                onChange={(event) =>
                  setDraft({ ...draft, categoryGroup: event.target.value })
                }
                placeholder="support / retainer_work"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
              <Label htmlFor="rt-billable">Billable</Label>
              <Switch
                id="rt-billable"
                checked={draft.isBillable}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    isBillable: checked,
                    creditCost: checked ? draft.creditCost : '0',
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
              <Label htmlFor="rt-active">Active</Label>
              <Switch
                id="rt-active"
                checked={draft.isActive}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, isActive: checked })
                }
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {sorted.length === 0 ? (
          <li className="text-sm text-[var(--workspace-shell-text-muted)]">
            No request types yet. Add categories clients can pick when
            submitting work.
          </li>
        ) : (
          sorted.map((row, index) => (
            <li
              key={row.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3',
                row.isActive
                  ? 'border-[color:var(--workspace-shell-border)]'
                  : 'border-dashed opacity-60',
              )}
            >
              <div>
                <p className="text-sm font-medium">
                  {row.label}
                  {row.categoryGroup ? (
                    <span className="text-xs font-normal text-[var(--workspace-shell-text-muted)]">
                      {' '}
                      · {row.categoryGroup}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {row.isBillable
                    ? `${row.creditCost} credit${row.creditCost === 1 ? '' : 's'}`
                    : 'Not billable'}
                  {!row.isActive ? ' · archived' : null}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={pending || index === 0}
                    onClick={() => move(row.id, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={pending || index === sorted.length - 1}
                    onClick={() => move(row.id, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(row)}
                  >
                    Edit
                  </Button>
                  {row.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => archive(row.id)}
                    >
                      Archive
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
