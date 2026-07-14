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
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type { PlanTemplateRecord } from '~/lib/billing/plan-templates-types';
import {
  type PlanTemplateKind,
  formatMinorUnits,
  planTemplateKindLabel,
} from '~/lib/billing/plan-templates-types';

import {
  deletePlanTemplateAction,
  upsertPlanTemplateAction,
} from '../_lib/server/plan-templates-actions';

const KINDS: PlanTemplateKind[] = [
  'hosting',
  'retainer',
  'care_plan',
  'custom',
];

type Draft = {
  id?: string;
  kind: PlanTemplateKind;
  name: string;
  description: string;
  amountPounds: string;
  interval: 'month' | 'year';
  active: boolean;
};

const emptyDraft = (): Draft => ({
  kind: 'hosting',
  name: '',
  description: '',
  amountPounds: '45',
  interval: 'month',
  active: true,
});

export function ServicesPlansPanel({
  accountId,
  initialTemplates,
  canEdit,
}: {
  accountId: string;
  initialTemplates: PlanTemplateRecord[];
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) =>
        a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }),
      ),
    [templates],
  );

  function startCreate() {
    setDraft(emptyDraft());
  }

  function startEdit(row: PlanTemplateRecord) {
    setDraft({
      id: row.id,
      kind: row.kind,
      name: row.name,
      description: row.description ?? '',
      amountPounds: (row.amount / 100).toFixed(2),
      interval: row.interval,
      active: row.active,
    });
  }

  function save() {
    if (!draft) return;
    const pounds = Number(draft.amountPounds);
    if (!Number.isFinite(pounds) || pounds < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const amount = Math.round(pounds * 100);

    startTransition(async () => {
      try {
        const saved = await upsertPlanTemplateAction({
          accountId,
          id: draft.id,
          kind: draft.kind,
          name: draft.name,
          description: draft.description || null,
          amount,
          currency: 'gbp',
          interval: draft.interval,
          active: draft.active,
        });
        setTemplates((current) => {
          const without = current.filter((row) => row.id !== saved.id);
          return [...without, saved];
        });
        setDraft(null);
        toast.success(draft.id ? 'Plan updated' : 'Plan created');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save');
      }
    });
  }

  function archive(id: string) {
    startTransition(async () => {
      try {
        await deletePlanTemplateAction({ accountId, id });
        setTemplates((current) =>
          current.map((row) =>
            row.id === id ? { ...row, active: false } : row,
          ),
        );
        toast.success('Plan archived');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not archive',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Recurring services
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            Hosting plans and retainers billed to clients via Stripe Connect.
            Changing the price creates a new Stripe price for future
            subscriptions; existing clients keep their current price. To change
            a live client amount, cancel and create a new subscription (no
            prorations in this version).
          </p>
        </div>
        {canEdit ? (
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="mr-1 size-4" />
            New plan
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
          <p className="text-sm font-medium">
            {draft.id ? 'Edit plan' : 'New plan'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select
                value={draft.kind}
                onValueChange={(value) =>
                  setDraft({ ...draft, kind: value as PlanTemplateKind })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {planTemplateKindLabel(kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Interval</Label>
              <Select
                value={draft.interval}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    interval: value as 'month' | 'year',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                placeholder="Managed hosting"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (GBP)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.amountPounds}
                onChange={(event) =>
                  setDraft({ ...draft, amountPounds: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                rows={3}
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
            No plans yet. Create a hosting or retainer template to attach to
            clients.
          </li>
        ) : (
          sorted.map((row) => (
            <li
              key={row.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3',
                row.active
                  ? 'border-[color:var(--workspace-shell-border)]'
                  : 'border-dashed opacity-60',
              )}
            >
              <div>
                <p className="text-sm font-medium">
                  {row.name}{' '}
                  <span className="text-xs font-normal text-[var(--workspace-shell-text-muted)]">
                    · {planTemplateKindLabel(row.kind)}
                  </span>
                </p>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {formatMinorUnits(row.amount, row.currency, row.interval)}
                  {!row.active ? ' · archived' : null}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(row)}
                  >
                    Edit
                  </Button>
                  {row.active ? (
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
