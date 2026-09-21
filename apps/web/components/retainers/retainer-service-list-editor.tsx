'use client';

import { useMemo, useState } from 'react';

import { Loader2, Plus } from 'lucide-react';

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
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type {
  CatalogueService,
  EffectiveService,
} from '~/lib/retainers/effective-services';

type Draft = {
  id?: string;
  name: string;
  description: string;
  creditCost: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  creditCost: '1',
  isActive: true,
});

export function RetainerServiceListEditor({
  services,
  library,
  inheritanceLabel,
  resetLabel,
  customized,
  canEdit,
  pending,
  emptyHint,
  onReplace,
  onReset,
  onAddCustom,
}: {
  services: EffectiveService[];
  library: CatalogueService[];
  inheritanceLabel: string;
  resetLabel: string;
  customized: boolean;
  canEdit: boolean;
  pending: boolean;
  emptyHint?: string;
  onReplace: (next: EffectiveService[]) => void;
  onReset: () => void;
  onAddCustom: (input: {
    name: string;
    description: string | null;
    creditCost: number;
  }) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [libraryId, setLibraryId] = useState('');

  const inList = useMemo(
    () => new Set(services.map((row) => row.id)),
    [services],
  );
  const availableLibrary = library.filter(
    (row) => row.isActive && !inList.has(row.id),
  );

  function persist(next: EffectiveService[]) {
    onReplace(
      next.map((row, index) => ({
        ...row,
        sortOrder: index,
      })),
    );
  }

  function saveDraft() {
    if (!draft) return;
    const creditCost = Number(draft.creditCost);
    if (!draft.name.trim()) return;
    if (!Number.isFinite(creditCost) || creditCost < 1) return;

    if (draft.id) {
      persist(
        services.map((row) =>
          row.id === draft.id
            ? {
                ...row,
                name: draft.name.trim(),
                description: draft.description.trim() || null,
                creditCost: Math.round(creditCost),
                isActive: draft.isActive,
              }
            : row,
        ),
      );
      setDraft(null);
      return;
    }

    onAddCustom({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      creditCost: Math.round(creditCost),
    });
    setDraft(null);
  }

  function addFromLibrary() {
    const picked = availableLibrary.find((row) => row.id === libraryId);
    if (!picked) return;
    persist([
      ...services,
      {
        id: picked.id,
        sourceServiceId: picked.sourceServiceId,
        name: picked.name,
        description: picked.description,
        creditCost: picked.creditCost,
        requestTypeId: picked.requestTypeId,
        isActive: true,
        sortOrder: services.length,
        scope: picked.scope,
      },
    ]);
    setLibraryId('');
  }

  function remove(id: string) {
    persist(services.filter((row) => row.id !== id));
  }

  function toggleActive(id: string, isActive: boolean) {
    persist(
      services.map((row) => (row.id === id ? { ...row, isActive } : row)),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
            {inheritanceLabel}
          </p>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            Credits only — no time shown to clients. 10 credits ≈ 15 minutes is
            internal packing.
          </p>
        </div>
        {canEdit && customized ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onReset}
          >
            {resetLabel}
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          {availableLibrary.length > 0 ? (
            <>
              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-xs">Add from library</Label>
                <Select value={libraryId} onValueChange={setLibraryId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLibrary.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name} · {row.creditCost}c
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !libraryId}
                onClick={addFromLibrary}
              >
                Add
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || draft !== null}
            onClick={() => setDraft(emptyDraft())}
          >
            <Plus className="mr-1 size-3.5" />
            Add custom
          </Button>
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder="Service name"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description / match hints</Label>
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                className="min-h-[64px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Credits</Label>
              <Input
                type="number"
                min={1}
                value={draft.creditCost}
                onChange={(event) =>
                  setDraft({ ...draft, creditCost: event.target.value })
                }
              />
            </div>
            {draft.id ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
                <Label className="text-xs">Active</Label>
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, isActive: checked })
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={saveDraft}
            >
              {pending ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : null}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {services.length === 0 ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {emptyHint ?? 'No services on this list yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((service) => (
            <li
              key={service.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2',
                service.isActive
                  ? 'border-[color:var(--workspace-shell-border)]'
                  : 'border-dashed opacity-60',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--workspace-shell-text)]">
                  {service.name}
                  <span className="ml-1 text-xs text-[var(--workspace-shell-text-muted)]">
                    {service.creditCost} credit
                    {service.creditCost === 1 ? '' : 's'}
                    {!service.isActive ? ' · off' : ''}
                  </span>
                </p>
                {service.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--workspace-shell-text-muted)]">
                    {service.description}
                  </p>
                ) : null}
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1">
                  <Switch
                    checked={service.isActive}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      toggleActive(service.id, checked)
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      setDraft({
                        id: service.id,
                        name: service.name,
                        description: service.description ?? '',
                        creditCost: String(service.creditCost),
                        isActive: service.isActive,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(service.id)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
