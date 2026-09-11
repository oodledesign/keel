'use client';

import { useMemo, useRef, useState, useTransition } from 'react';

import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  PROJECT_STATUS_COLOR_PRESETS,
  type ProjectStatus,
  type ProjectStatusCategory,
  contrastTextOnStatusColor,
} from '~/lib/projects/project-statuses';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import {
  createProjectStatus,
  deleteProjectStatus,
  reorderProjectStatuses,
  updateProjectStatus,
} from '../../../projects/_lib/server/project-status-actions';

type Draft = {
  id?: string;
  label: string;
  color: string;
  category: ProjectStatusCategory;
  isDefault: boolean;
};

const emptyDraft = (): Draft => ({
  label: '',
  color: PROJECT_STATUS_COLOR_PRESETS[1] ?? '#FF5C34',
  category: 'open',
  isDefault: false,
});

const CATEGORY_LABELS: Record<ProjectStatusCategory, string> = {
  open: 'Active pipeline',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function ProjectStatusesPanel({
  accountId,
  accountSlug,
  initialStatuses,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  initialStatuses: ProjectStatus[];
  canEdit: boolean;
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const lastSavedStatuses = useRef(initialStatuses);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [remapToId, setRemapToId] = useState<string>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...statuses].sort((a, b) => a.sortOrder - b.sortOrder),
    [statuses],
  );

  function startCreate() {
    setPendingDeleteId(null);
    setDraft(emptyDraft());
  }

  function startEdit(row: ProjectStatus) {
    setPendingDeleteId(null);
    setDraft({
      id: row.id,
      label: row.label,
      color: row.color,
      category: row.category,
      isDefault: row.isDefault,
    });
  }

  function save() {
    if (!draft) return;
    if (!draft.label.trim()) {
      toast.error('Label is required');
      return;
    }

    startTransition(async () => {
      try {
        if (draft.id) {
          const saved = await updateProjectStatus({
            accountId,
            accountSlug,
            id: draft.id,
            label: draft.label.trim(),
            color: draft.color,
            category: draft.category,
            isDefault: draft.isDefault,
          });
          setStatuses((current) => {
            const next = current.map((row) => {
              if (row.id === saved.id) return saved;
              if (saved.isDefault && row.isDefault) {
                return { ...row, isDefault: false };
              }
              return row;
            });
            lastSavedStatuses.current = next;
            return next;
          });
          toast.success('Status updated');
        } else {
          const saved = await createProjectStatus({
            accountId,
            accountSlug,
            label: draft.label.trim(),
            color: draft.color,
            category: draft.category,
            isDefault: draft.isDefault,
          });
          setStatuses((current) => {
            const next = draft.isDefault
              ? current.map((row) => ({ ...row, isDefault: false }))
              : current;
            const created = [...next, saved];
            lastSavedStatuses.current = created;
            return created;
          });
          toast.success('Status added');
        }
        setDraft(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save status',
        );
      }
    });
  }

  function remove(id: string) {
    const usedElsewhere = statuses.filter((row) => row.id !== id);
    startTransition(async () => {
      try {
        await deleteProjectStatus({
          accountId,
          accountSlug,
          id,
          remapToId: remapToId || undefined,
        });
        const next = usedElsewhere.map((row, index) => ({
          ...row,
          sortOrder: index,
        }));
        lastSavedStatuses.current = next;
        setStatuses(next);
        setPendingDeleteId(null);
        setRemapToId('');
        toast.success('Status removed');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete status',
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

    const byId = new Map(statuses.map((row) => [row.id, row]));
    setStatuses(
      next.map((rowId, sortOrder) => ({
        ...byId.get(rowId)!,
        sortOrder,
      })),
    );

    startTransition(async () => {
      try {
        await reorderProjectStatuses({
          accountId,
          accountSlug,
          orderedIds: next,
        });
        lastSavedStatuses.current = next.map((rowId, sortOrder) => ({
          ...byId.get(rowId)!,
          sortOrder,
        }));
      } catch (error) {
        setStatuses(lastSavedStatuses.current);
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
          <h2 className="text-base font-semibold tracking-tight text-[var(--workspace-shell-text)]">
            Project statuses
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Customise the pipeline for delivery projects. Add labels such as
            Invoiced, rename existing ones, or reorder the board columns.
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || draft !== null}
            onClick={startCreate}
            data-test="add-project-status"
          >
            <Plus className="mr-1 size-4" />
            Add status
          </Button>
        ) : null}
      </div>

      <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        {sorted.map((row, index) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <span
              className="inline-flex h-7 min-w-20 items-center justify-center rounded px-2 text-xs font-medium"
              style={{
                backgroundColor: row.color,
                color: contrastTextOnStatusColor(row.color),
              }}
            >
              {row.label}
            </span>
            <span className="text-xs text-[var(--workspace-shell-text-muted)]">
              {CATEGORY_LABELS[row.category]}
              {row.isDefault ? ' · Default for new projects' : ''}
            </span>
            {canEdit ? (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending || index === 0}
                  onClick={() => move(row.id, -1)}
                  aria-label={`Move ${row.label} up`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending || index === sorted.length - 1}
                  onClick={() => move(row.id, 1)}
                  aria-label={`Move ${row.label} down`}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => startEdit(row)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending || sorted.length <= 1}
                  onClick={() => {
                    setDraft(null);
                    setPendingDeleteId(row.id);
                    setRemapToId(
                      sorted.find((item) => item.id !== row.id)?.id ?? '',
                    );
                  }}
                  aria-label={`Delete ${row.label}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-label">Label</Label>
              <Input
                id="status-label"
                value={draft.label}
                onChange={(event) =>
                  setDraft({ ...draft, label: event.target.value })
                }
                placeholder="Invoiced"
                data-test="project-status-label"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Select
                value={draft.category}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    category: value as ProjectStatusCategory,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={workspaceSelectContentClass}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem
                      key={value}
                      value={value}
                      className={workspaceSelectItemClass}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUS_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    'size-7 rounded-full border-2',
                    draft.color === color
                      ? 'border-[var(--workspace-shell-text)]'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setDraft({ ...draft, color })}
                  aria-label={`Use colour ${color}`}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]">
            <Checkbox
              checked={draft.isDefault}
              onCheckedChange={(checked) =>
                setDraft({ ...draft, isDefault: checked === true })
              }
              data-test="project-status-default"
            />
            Default for new projects
          </label>

          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              {draft.id ? 'Save status' : 'Add status'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {pendingDeleteId ? (
        <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <p className="text-sm text-[var(--workspace-shell-text)]">
            If any projects use this status, move them to:
          </p>
          <Select value={remapToId} onValueChange={setRemapToId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a status" />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              {sorted
                .filter((row) => row.id !== pendingDeleteId)
                .map((row) => (
                  <SelectItem
                    key={row.id}
                    value={row.id}
                    className={workspaceSelectItemClass}
                  >
                    {row.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => remove(pendingDeleteId)}
            >
              Delete status
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setPendingDeleteId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
