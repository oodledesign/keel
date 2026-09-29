'use client';

import { useState, useTransition } from 'react';

import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  type CreditTopupPack,
  CreditTopupPackListSchema,
  DEFAULT_CREDIT_TOPUP_PACKS,
  MAX_CREDIT_TOPUP_PACKS,
} from '~/lib/credits/credit-topup-packs';

import { updateCreditTopupPacksAction } from '../_lib/server/credit-topup-packs-actions';

type DraftRow = { key: string; credits: string; pounds: string };

function toDraft(packs: CreditTopupPack[]): DraftRow[] {
  return packs.map((pack) => ({
    key: pack.id,
    credits: String(pack.units),
    pounds: (pack.totalPence / 100).toFixed(2),
  }));
}

function formatPounds(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

export function CreditTopupPacksPanel({
  accountId,
  initialPacks,
  initialIsCustom,
  canEdit,
}: {
  accountId: string;
  initialPacks: CreditTopupPack[];
  initialIsCustom: boolean;
  canEdit: boolean;
}) {
  const [packs, setPacks] = useState(initialPacks);
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(next: Parameters<typeof updateCreditTopupPacksAction>[0]) {
    startTransition(async () => {
      try {
        const saved = await updateCreditTopupPacksAction(next);
        setPacks(saved.packs);
        setIsCustom(saved.isCustom);
        setDraft(null);
        toast.success(
          next.packs === null ? 'Reset to default packs' : 'Top-up packs saved',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save packs',
        );
      }
    });
  }

  function save() {
    if (!draft) return;
    const parsed = CreditTopupPackListSchema.safeParse(
      draft.map((row) => ({
        units: Math.round(Number(row.credits)),
        totalPence: Math.round(Number(row.pounds) * 100),
      })),
    );
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(
        issue?.path.includes('totalPence')
          ? 'Each pack needs a price of at least £1'
          : issue?.path.includes('units')
            ? 'Each pack needs a whole number of credits'
            : (issue?.message ?? 'Check the pack values'),
      );
      return;
    }
    persist({ accountId, packs: parsed.data });
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setDraft((rows) =>
      rows
        ? rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
        : rows,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Credit top-up packs
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            One-off credit packs clients can buy from their portal. Top-up
            credits expire after 6 months. Packs are hidden while a client has a
            retainer awaiting payment.
          </p>
        </div>
        {canEdit && !draft ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDraft(toDraft(packs))}
          >
            Edit packs
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
          {draft.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No packs — clients won&apos;t be able to top up from the portal.
            </p>
          ) : (
            <div className="space-y-3">
              {draft.map((row) => (
                <div key={row.key} className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label>Credits</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className="w-28"
                      value={row.credits}
                      onChange={(event) =>
                        updateRow(row.key, { credits: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Price (GBP)</Label>
                    <Input
                      type="number"
                      min={1}
                      step="0.01"
                      className="w-32"
                      value={row.pounds}
                      onChange={(event) =>
                        updateRow(row.key, { pounds: event.target.value })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Remove pack"
                    disabled={pending}
                    onClick={() =>
                      setDraft((rows) =>
                        rows
                          ? rows.filter((item) => item.key !== row.key)
                          : rows,
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || draft.length >= MAX_CREDIT_TOPUP_PACKS}
              onClick={() =>
                setDraft((rows) => [
                  ...(rows ?? []),
                  { key: crypto.randomUUID(), credits: '', pounds: '' },
                ])
              }
            >
              <Plus className="mr-1 size-4" />
              Add pack
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
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
            {isCustom ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => persist({ accountId, packs: null })}
              >
                Reset to defaults
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {packs.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Top-ups are turned off. Clients can&apos;t buy extra credits from
              the portal.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-3">
              {packs.map((pack) => (
                <li
                  key={pack.id}
                  className="rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-3"
                >
                  <p className="text-sm font-medium">{pack.label}</p>
                  <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                    {formatPounds(pack.totalPence)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!isCustom ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Using the default packs (
              {DEFAULT_CREDIT_TOPUP_PACKS.map(
                (pack) => `${pack.units} for ${formatPounds(pack.totalPence)}`,
              ).join(', ')}
              ).
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
