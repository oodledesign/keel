'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { reviewPartnerCostLineAction } from '~/lib/projects/partner-cost-lines.actions';
import type { PartnerCostLine } from '~/lib/projects/partner-cost-lines.service';

function formatPence(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toFixed(2)}`;
}

function statusLabel(status: PartnerCostLine['status']) {
  if (status === 'draft') return 'Draft';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  return 'Rejected';
}

export function HostPartnerCostsPanel({
  accountSlug,
  accountId,
  projectId,
  canEdit,
  initialLines,
}: {
  accountSlug: string;
  accountId: string;
  projectId: string;
  canEdit: boolean;
  initialLines: PartnerCostLine[];
}) {
  const [lines, setLines] = useState(initialLines);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function review(lineId: string, status: 'approved' | 'rejected') {
    startTransition(async () => {
      try {
        const updated = await reviewPartnerCostLineAction({
          lineId,
          ownerAccountId: accountId,
          status,
          reviewNote: notes[lineId]?.trim() || null,
          accountSlug,
          projectId,
        });
        setLines((prev) =>
          prev.map((line) => (line.id === lineId ? updated : line)),
        );
        toast.success(status === 'approved' ? 'Approved' : 'Rejected');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not update status',
        );
      }
    });
  }

  if (lines.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No partner cost lines on this project yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[var(--workspace-shell-panel)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Partner</th>
            <th className="px-3 py-2 font-medium">Line</th>
            <th className="px-3 py-2 font-medium">Estimate</th>
            <th className="px-3 py-2 font-medium">Actual</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Review</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.id}
              className="border-t border-[color:var(--workspace-shell-border)]"
            >
              <td className="px-3 py-2 align-top text-[var(--workspace-shell-text)]">
                {line.partnerAccountName ?? 'Partner'}
              </td>
              <td className="px-3 py-2 align-top">
                <p className="font-medium text-[var(--workspace-shell-text)]">
                  {line.title}
                </p>
                {line.description ? (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {line.description}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 align-top">
                {formatPence(line.estimatePence)}
              </td>
              <td className="px-3 py-2 align-top">
                {formatPence(line.actualPence)}
              </td>
              <td className="px-3 py-2 align-top text-[var(--workspace-shell-text-muted)]">
                {statusLabel(line.status)}
              </td>
              <td className="px-3 py-2 align-top">
                {line.status === 'submitted' && canEdit ? (
                  <div className="space-y-2">
                    <Input
                      value={notes[line.id] ?? ''}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [line.id]: e.target.value,
                        }))
                      }
                      placeholder="Note (optional)"
                      className="h-8 border-[color:var(--workspace-shell-border)]"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => review(line.id, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => review(line.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : line.reviewNote ? (
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {line.reviewNote}
                  </p>
                ) : (
                  <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
