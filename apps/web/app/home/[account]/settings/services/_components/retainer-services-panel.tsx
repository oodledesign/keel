'use client';

import { useMemo, useState, useTransition } from 'react';

import { ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
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
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type { RequestTypeRecord } from '~/lib/credits/request-types-types';
import type { ServiceCategory } from '~/lib/retainers/effective-services';
import { groupServicesByCategory } from '~/lib/retainers/effective-services';
import type { RetainerServiceRecord } from '~/lib/retainers/types';

import {
  deleteRetainerServiceAction,
  deleteRetainerServiceCategoryAction,
  listRetainerServiceCategoriesAction,
  patchRetainerServiceAction,
  reorderRetainerServiceCategoriesAction,
  seedDefaultRetainerServicesAction,
  upsertRetainerServiceAction,
  upsertRetainerServiceCategoryAction,
} from '../_lib/server/retainer-services-actions';

type Draft = {
  id?: string;
  name: string;
  description: string;
  creditCost: string;
  defaultStatus: string;
  defaultDurationMinutes: string;
  requestTypeId: string;
  categoryId: string;
  isActive: boolean;
  isVisible: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  creditCost: '1',
  defaultStatus: '',
  defaultDurationMinutes: '',
  requestTypeId: '',
  categoryId: '',
  isActive: true,
  isVisible: true,
});

export function RetainerServicesPanel({
  accountId,
  initialServices,
  initialCategories = [],
  requestTypes = [],
  canEdit,
}: {
  accountId: string;
  initialServices: RetainerServiceRecord[];
  initialCategories?: ServiceCategory[];
  requestTypes?: RequestTypeRecord[];
  canEdit: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(
    () =>
      groupServicesByCategory(
        services.map((row) => ({
          ...row,
          categorySortOrder:
            categories.find((category) => category.id === row.categoryId)
              ?.sortOrder ?? 1_000_000,
        })),
        categories,
      ),
    [services, categories],
  );

  function startCreate() {
    setDraft(emptyDraft());
  }

  function startEdit(row: RetainerServiceRecord) {
    setDraft({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      creditCost: String(row.creditCost),
      defaultStatus: row.defaultStatus ?? '',
      defaultDurationMinutes: row.defaultDurationMinutes
        ? String(row.defaultDurationMinutes)
        : '',
      requestTypeId: row.requestTypeId ?? '',
      categoryId: row.categoryId ?? '',
      isActive: row.isActive,
      isVisible: row.isVisible,
    });
  }

  function save() {
    if (!draft) return;
    const creditCost = Number(draft.creditCost);
    if (!Number.isFinite(creditCost) || creditCost < 1) {
      toast.error('Credit cost must be at least 1');
      return;
    }
    if (!draft.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const duration = draft.defaultDurationMinutes.trim()
      ? Number(draft.defaultDurationMinutes)
      : null;
    if (duration != null && (!Number.isFinite(duration) || duration < 1)) {
      toast.error('Duration must be a positive number of minutes');
      return;
    }

    const existing = draft.id
      ? services.find((row) => row.id === draft.id)
      : null;

    startTransition(async () => {
      try {
        const saved = await upsertRetainerServiceAction({
          accountId,
          id: draft.id,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          creditCost: Math.round(creditCost),
          defaultStatus:
            draft.defaultStatus === 'todo' ||
            draft.defaultStatus === 'in_progress' ||
            draft.defaultStatus === 'client_review'
              ? draft.defaultStatus
              : null,
          defaultDurationMinutes: duration,
          sortOrder: existing?.sortOrder ?? 0,
          isActive: draft.isActive,
          isVisible: draft.isVisible,
          categoryId: draft.categoryId || null,
          requestTypeId: draft.requestTypeId || null,
        });
        setServices((current) => {
          const without = current.filter((row) => row.id !== saved.id);
          return [...without, saved];
        });
        setDraft(null);
        toast.success(draft.id ? 'Service updated' : 'Service created');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save service',
        );
      }
    });
  }

  function archive(id: string) {
    startTransition(async () => {
      try {
        await deleteRetainerServiceAction({ accountId, id });
        setServices((current) =>
          current.map((row) =>
            row.id === id ? { ...row, isActive: false } : row,
          ),
        );
        toast.success('Service archived');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not archive service',
        );
      }
    });
  }

  function toggleVisible(row: RetainerServiceRecord, isVisible: boolean) {
    startTransition(async () => {
      try {
        const saved = await patchRetainerServiceAction({
          accountId,
          id: row.id,
          isVisible,
        });
        setServices((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update visibility',
        );
      }
    });
  }

  function addCategory() {
    const name = categoryName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const saved = await upsertRetainerServiceCategoryAction({
          accountId,
          name,
        });
        setCategories((current) => [...current, saved]);
        setCategoryName('');
        toast.success('Category added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add category',
        );
      }
    });
  }

  function renameCategory(row: ServiceCategory) {
    const name = window.prompt('Rename category', row.name)?.trim();
    if (!name || name === row.name) return;
    startTransition(async () => {
      try {
        const saved = await upsertRetainerServiceCategoryAction({
          accountId,
          id: row.id,
          name,
          sortOrder: row.sortOrder,
        });
        setCategories((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rename category',
        );
      }
    });
  }

  function removeCategory(row: ServiceCategory) {
    startTransition(async () => {
      try {
        await deleteRetainerServiceCategoryAction({
          accountId,
          id: row.id,
        });
        setCategories((current) =>
          current.filter((item) => item.id !== row.id),
        );
        setServices((current) =>
          current.map((item) =>
            item.categoryId === row.id ? { ...item, categoryId: null } : item,
          ),
        );
        toast.success('Category removed. Services are now uncategorized.');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete category',
        );
      }
    });
  }

  function moveCategory(index: number, delta: number) {
    const previous = categories;
    const next = [...categories].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }),
    );
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    const ids = next.map((row) => row.id);
    setCategories(next.map((row, sortOrder) => ({ ...row, sortOrder })));
    startTransition(async () => {
      try {
        const saved = await reorderRetainerServiceCategoriesAction({
          accountId,
          ids,
        });
        setCategories(saved);
      } catch (error) {
        setCategories(previous);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not reorder categories',
        );
      }
    });
  }

  function seedDefaults() {
    startTransition(async () => {
      try {
        const seeded = await seedDefaultRetainerServicesAction({ accountId });
        const nextCategories = await listRetainerServiceCategoriesAction({
          accountId,
        });
        setServices(seeded);
        setCategories(nextCategories);
        toast.success('Starter catalogue added');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not add starter catalogue',
        );
      }
    });
  }

  const sortedCategories = [...categories].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Workspace service library
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Default catalogue for new clients, matching, and the portal when
            nothing is customized. Hidden services stay here for internal use.
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {services.length === 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={seedDefaults}
              >
                Add starter catalogue
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || draft !== null}
              onClick={startCreate}
            >
              <Plus className="mr-1 size-4" />
              Add service
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
        <p className="text-sm font-medium">Categories</p>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Workspace-only groups. Deleting a category leaves its services
          uncategorized.
        </p>
        {sortedCategories.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            No categories yet. Add Web, Support, or Calls — or load the starter
            catalogue.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sortedCategories.map((row, index) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2"
              >
                <span className="text-sm">{row.name}</span>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending || index === 0}
                      onClick={() => moveCategory(index, -1)}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={
                        pending || index === sortedCategories.length - 1
                      }
                      onClick={() => moveCategory(index, 1)}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => renameCategory(row)}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => removeCategory(row)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1 space-y-1">
              <Label className="text-xs">New category</Label>
              <Input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="e.g. Web"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !categoryName.trim()}
              onClick={addCategory}
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>

      {draft ? (
        <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder="e.g. Monthly SEO blog"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description / match hints</Label>
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                placeholder="What this covers, phrases clients use in email"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Credit cost</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={draft.creditCost}
                onChange={(event) =>
                  setDraft({ ...draft, creditCost: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={draft.categoryId || '__none__'}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    categoryId: value === '__none__' ? '' : value,
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Uncategorized</SelectItem>
                  {sortedCategories.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                step={15}
                value={draft.defaultDurationMinutes}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    defaultDurationMinutes: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default task status</Label>
              <Select
                value={draft.defaultStatus || 'todo'}
                onValueChange={(value) =>
                  setDraft({ ...draft, defaultStatus: value })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="To do" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="client_review">Client review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Portal request type (optional)</Label>
              <Select
                value={draft.requestTypeId || '__none__'}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    requestTypeId: value === '__none__' ? '' : value,
                  })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {requestTypes
                    .filter((row) => row.isActive && !row.isSupport)
                    .map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
              <Label htmlFor="rs-visible">Visible to client</Label>
              <Switch
                id="rs-visible"
                checked={draft.isVisible}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, isVisible: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
              <Label htmlFor="rs-active">Active</Label>
              <Switch
                id="rs-active"
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

      <div className="space-y-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No workspace services yet. Add the work you sell on retainers, or
            load a starter catalogue. Existing client and project lists are
            never overwritten.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.id ?? 'uncategorized'} className="space-y-2">
              <p className="text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                {group.name}
              </p>
              <ul className="space-y-2">
                {group.services.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3',
                      row.isActive && row.isVisible
                        ? 'border-[color:var(--workspace-shell-border)]'
                        : 'border-dashed opacity-70',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                        {row.creditCost} credit
                        {row.creditCost === 1 ? '' : 's'}
                        {row.defaultDurationMinutes
                          ? ` · ${row.defaultDurationMinutes} min`
                          : ''}
                        {!row.isVisible ? ' · hidden' : null}
                        {!row.isActive ? ' · archived' : null}
                      </p>
                      {row.description ? (
                        <p className="mt-1 max-w-xl text-xs text-[var(--workspace-shell-text-muted)]">
                          {row.description}
                        </p>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                            Visible
                          </span>
                          <Switch
                            checked={row.isVisible}
                            disabled={pending}
                            onCheckedChange={(checked) =>
                              toggleVisible(row, checked)
                            }
                          />
                        </div>
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
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
