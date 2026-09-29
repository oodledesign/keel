'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Loader2, RotateCcw, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  COMMERCIAL_PIPELINE_STAGE_LABELS,
  REQUIREMENT_STATUS_LABELS,
} from '~/lib/commercial/commercial-constants';

import {
  type ArchivedWip,
  deleteInstructionForever,
  deleteRequirementForever,
  listArchivedWip,
  restoreInstruction,
  restoreRequirement,
} from '../_lib/server/wip-archive.actions';

type Tab = 'instructions' | 'requirements';

type Row = {
  id: string;
  name: string;
  stageLabel: string;
  archivedAt: string;
};

const EMPTY: ArchivedWip = { instructions: [], requirements: [] };

function formatArchivedOn(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Everything archived from the WIP board, with Restore for anyone who can
 * edit and permanent Delete for owners and admins.
 */
export function WipArchivedDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  canDelete,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug?: string | null;
  canDelete: boolean;
  /** Something was restored or deleted, so the board should reload. */
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>('instructions');
  const [data, setData] = useState<ArchivedWip>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<
    (Row & { tab: Tab }) | null
  >(null);
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    listArchivedWip({ accountId })
      .then(setData)
      .catch((error: unknown) => setLoadError(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const scopeFor = (id: string) => ({
    accountId,
    accountSlug: accountSlug?.trim() || undefined,
    id,
  });

  function removeLocally(kind: Tab, id: string) {
    setData((prev) => ({
      instructions:
        kind === 'instructions'
          ? prev.instructions.filter((row) => row.id !== id)
          : prev.instructions,
      requirements:
        kind === 'requirements'
          ? prev.requirements.filter((row) => row.id !== id)
          : prev.requirements,
    }));
  }

  function handleRestore(kind: Tab, row: Row) {
    markBusy(row.id, true);
    startTransition(async () => {
      try {
        const action =
          kind === 'instructions' ? restoreInstruction : restoreRequirement;
        await action(scopeFor(row.id));
        removeLocally(kind, row.id);
        toast.success(`Restored “${row.name}”`);
        onChanged();
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        markBusy(row.id, false);
      }
    });
  }

  function handleDelete(target: Row & { tab: Tab }) {
    markBusy(target.id, true);
    startTransition(async () => {
      try {
        const action =
          target.tab === 'instructions'
            ? deleteInstructionForever
            : deleteRequirementForever;
        await action(scopeFor(target.id));
        removeLocally(target.tab, target.id);
        setPendingDelete(null);
        toast.success(`Deleted “${target.name}”`);
        onChanged();
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        markBusy(target.id, false);
      }
    });
  }

  const pendingBusy = pendingDelete ? busyIds.has(pendingDelete.id) : false;

  const stageLabels = COMMERCIAL_PIPELINE_STAGE_LABELS as Record<
    string,
    string
  >;
  const requirementLabels = REQUIREMENT_STATUS_LABELS as Record<string, string>;

  const rows: Row[] =
    tab === 'instructions'
      ? data.instructions.map((item) => ({
          id: item.id,
          name: item.name,
          stageLabel: stageLabels[item.stage] ?? item.stage,
          archivedAt: item.archivedAt,
        }))
      : data.requirements.map((item) => ({
          id: item.id,
          name: item.name,
          stageLabel: requirementLabels[item.stage] ?? item.stage,
          archivedAt: item.archivedAt,
        }));

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    {
      key: 'instructions',
      label: 'Instructions',
      count: data.instructions.length,
    },
    {
      key: 'requirements',
      label: 'Requirements',
      count: data.requirements.length,
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-test="wip-archived-dialog"
          className="flex max-h-[85vh] max-w-xl flex-col gap-4 border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        >
          <DialogHeader>
            <DialogTitle>Archived</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Hidden from the board, totals, reports and matching. Restore
              anything you archived by mistake.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2" role="tablist" aria-label="Archived type">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                data-test={`wip-archived-tab-${item.key}`}
                onClick={() => setTab(item.key)}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                  tab === item.key
                    ? 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                    : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          <div className="min-h-[8rem] flex-1 overflow-y-auto">
            {loading ? (
              <p className="flex items-center gap-2 py-6 text-sm text-[var(--workspace-shell-text-muted)]">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                Loading archived…
              </p>
            ) : loadError ? (
              <div className="space-y-2 py-4">
                <p className="text-sm text-rose-500">{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={load}
                >
                  Try again
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <p className="py-6 text-sm text-[var(--workspace-shell-text-muted)]">
                Nothing archived here.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    data-test="wip-archived-row"
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                        {row.stageLabel} · archived{' '}
                        {formatArchivedOn(row.archivedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyIds.has(row.id)}
                        data-test="wip-archived-restore"
                        onClick={() => handleRestore(tab, row)}
                      >
                        <RotateCcw aria-hidden className="h-4 w-4" />
                        Restore
                      </Button>
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyIds.has(row.id)}
                          aria-label={`Delete ${row.name} permanently`}
                          data-test="wip-archived-delete"
                          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                          onClick={() => setPendingDelete({ ...row, tab })}
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next && !busyIds.has(pendingDelete?.id ?? '')) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent
          data-test="wip-archived-delete-dialog"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-[var(--workspace-shell-text-muted)]">
              <span className="block">
                “{pendingDelete?.name}” will be removed for everyone and
                can&apos;t be recovered.
              </span>
              <span className="block">
                {pendingDelete?.tab === 'requirements'
                  ? 'Its listing matches and interest are deleted with it. Notes and tasks stay, but are no longer linked to it.'
                  : 'Its compliance and client-care records are deleted with it. Notes and tasks stay, but are no longer linked to it.'}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingBusy}
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) handleDelete(pendingDelete);
              }}
            >
              {pendingBusy ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
