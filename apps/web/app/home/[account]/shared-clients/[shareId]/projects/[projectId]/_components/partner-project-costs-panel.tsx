'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  createPartnerCostLineAction,
  deletePartnerCostLineAction,
  submitPartnerCostLineAction,
  updatePartnerCostLineAction,
} from '~/lib/projects/partner-cost-lines.actions';
import type { PartnerCostLine } from '~/lib/projects/partner-cost-lines.service';

function formatPence(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

function poundsToPence(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function statusLabel(status: PartnerCostLine['status']) {
  if (status === 'draft') return 'Draft';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  return 'Rejected';
}

const EMPTY_FORM = {
  title: '',
  description: '',
  estimate: '',
  actual: '',
};

export function PartnerProjectCostsPanel({
  accountSlug,
  shareId,
  projectId,
  partnerAccountId,
  initialLines,
}: {
  accountSlug: string;
  shareId: string;
  projectId: string;
  partnerAccountId: string;
  initialLines: PartnerCostLine[];
}) {
  const [lines, setLines] = useState(initialLines);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, startTransition] = useTransition();

  const partnerCtx = {
    accountSlug,
    shareId,
    projectId,
    partnerAccountId,
  };

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        acc.estimate += line.estimatePence ?? 0;
        acc.actual += line.actualPence ?? 0;
        return acc;
      },
      { estimate: 0, actual: 0 },
    );
  }, [lines]);

  function refreshLine(next: PartnerCostLine) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === next.id);
      if (idx === -1) return [...prev, next];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const nextTitle = form.title.trim();
          if (!nextTitle) return;
          startTransition(async () => {
            try {
              const line = await createPartnerCostLineAction({
                ...partnerCtx,
                title: nextTitle,
                description: form.description.trim() || null,
                estimatePence: poundsToPence(form.estimate),
                actualPence: poundsToPence(form.actual),
              });
              setLines((prev) => [...prev, line]);
              setForm(EMPTY_FORM);
              toast.success('Cost line added');
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : 'Could not add line',
              );
            }
          });
        }}
      >
        <Input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Line title"
          required
          className="border-[color:var(--workspace-shell-border)] sm:col-span-2"
        />
        <Input
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Description (optional)"
          className="border-[color:var(--workspace-shell-border)] sm:col-span-2"
        />
        <Input
          value={form.estimate}
          onChange={(e) =>
            setForm((f) => ({ ...f, estimate: e.target.value }))
          }
          placeholder="Estimate £"
          inputMode="decimal"
          className="border-[color:var(--workspace-shell-border)]"
        />
        <Input
          value={form.actual}
          onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))}
          placeholder="Actual £"
          inputMode="decimal"
          className="border-[color:var(--workspace-shell-border)]"
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || !form.title.trim()}>
            Add draft line
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[var(--workspace-shell-panel)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Estimate</th>
              <th className="px-3 py-2 font-medium">Actual</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const editable =
                line.status === 'draft' || line.status === 'rejected';
              return (
                <tr
                  key={line.id}
                  className="border-t border-[color:var(--workspace-shell-border)]"
                >
                  <td className="px-3 py-2 align-top">
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {line.title}
                    </p>
                    {line.description ? (
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {line.description}
                      </p>
                    ) : null}
                    {line.reviewNote ? (
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        Note: {line.reviewNote}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--workspace-shell-text)]">
                    {editable ? (
                      <Input
                        defaultValue={
                          line.estimatePence != null
                            ? (line.estimatePence / 100).toFixed(2)
                            : ''
                        }
                        className="h-8 w-24 border-[color:var(--workspace-shell-border)]"
                        disabled={pending}
                        onBlur={(e) => {
                          const next = poundsToPence(e.target.value);
                          if (next === line.estimatePence) return;
                          startTransition(async () => {
                            try {
                              const updated = await updatePartnerCostLineAction(
                                {
                                  ...partnerCtx,
                                  lineId: line.id,
                                  estimatePence: next,
                                },
                              );
                              refreshLine(updated);
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : 'Could not update',
                              );
                            }
                          });
                        }}
                      />
                    ) : (
                      formatPence(line.estimatePence)
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--workspace-shell-text)]">
                    {editable ? (
                      <Input
                        defaultValue={
                          line.actualPence != null
                            ? (line.actualPence / 100).toFixed(2)
                            : ''
                        }
                        className="h-8 w-24 border-[color:var(--workspace-shell-border)]"
                        disabled={pending}
                        onBlur={(e) => {
                          const next = poundsToPence(e.target.value);
                          if (next === line.actualPence) return;
                          startTransition(async () => {
                            try {
                              const updated = await updatePartnerCostLineAction(
                                {
                                  ...partnerCtx,
                                  lineId: line.id,
                                  actualPence: next,
                                },
                              );
                              refreshLine(updated);
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : 'Could not update',
                              );
                            }
                          });
                        }}
                      />
                    ) : (
                      formatPence(line.actualPence)
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-[var(--workspace-shell-text-muted)]">
                    {statusLabel(line.status)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {editable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                const updated =
                                  await submitPartnerCostLineAction({
                                    ...partnerCtx,
                                    lineId: line.id,
                                  });
                                refreshLine(updated);
                                toast.success('Submitted for approval');
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not submit',
                                );
                              }
                            });
                          }}
                        >
                          Submit
                        </Button>
                      ) : null}
                      {editable ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              try {
                                await deletePartnerCostLineAction({
                                  ...partnerCtx,
                                  lineId: line.id,
                                });
                                setLines((prev) =>
                                  prev.filter((l) => l.id !== line.id),
                                );
                                toast.success('Line deleted');
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not delete',
                                );
                              }
                            });
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]"
                >
                  No cost lines yet. Add a draft above, then submit for
                  approval.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60">
              <td className="px-3 py-2 text-sm font-medium">Totals</td>
              <td className="px-3 py-2 text-sm font-medium">
                {formatPence(totals.estimate)}
              </td>
              <td className="px-3 py-2 text-sm font-medium">
                {formatPence(totals.actual)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
