'use client';

import { useMemo, useState, useTransition } from 'react';

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
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type { RetainerServiceRecord } from '~/lib/retainers/types';

import {
  deleteRetainerServiceAction,
  upsertRetainerServiceAction,
} from '../_lib/server/retainer-services-actions';

type Draft = {
  id?: string;
  name: string;
  description: string;
  creditCost: string;
  defaultStatus: string;
  defaultDurationMinutes: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  creditCost: '1',
  defaultStatus: '',
  defaultDurationMinutes: '',
  isActive: true,
});

export function RetainerServicesPanel({
  accountId,
  initialServices,
  canEdit,
}: {
  accountId: string;
  initialServices: RetainerServiceRecord[];
  canEdit: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...services].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }),
      ),
    [services],
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
      isActive: row.isActive,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Retainer services
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Catalogue used to match inbound client emails and burn project
            credits. New services always need a human confirm.
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
            Add service
          </Button>
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

      <ul className="space-y-2">
        {sorted.length === 0 ? (
          <li className="text-sm text-[var(--workspace-shell-text-muted)]">
            No retainer services yet. Add the work you sell on retainers so
            inbound email can be matched.
          </li>
        ) : (
          sorted.map((row) => (
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
                <p className="text-sm font-medium">{row.name}</p>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {row.creditCost} credit{row.creditCost === 1 ? '' : 's'}
                  {row.defaultDurationMinutes
                    ? ` · ${row.defaultDurationMinutes} min`
                    : ''}
                  {!row.isActive ? ' · archived' : null}
                </p>
                {row.description ? (
                  <p className="mt-1 max-w-xl text-xs text-[var(--workspace-shell-text-muted)]">
                    {row.description}
                  </p>
                ) : null}
              </div>
              {canEdit ? (
                <div className="flex gap-1">
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
