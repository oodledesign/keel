'use client';

import { useTransition } from 'react';

import { Undo2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { undoTaskRetainerBurnAction } from '~/home/[account]/projects/_lib/server/project-retainer-actions';

import { isUndoWindowOpen } from './credit-rules';

export function TaskRetainerStamp({
  accountId,
  accountSlug,
  taskId,
  serviceName,
  creditsBurned,
  creditsBurnedAt,
  canUndo,
  onUndone,
}: {
  accountId: string;
  accountSlug: string;
  taskId: string;
  serviceName: string | null;
  creditsBurned: number | null;
  creditsBurnedAt: string | null;
  canUndo: boolean;
  onUndone?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  if (!serviceName && !creditsBurned) return null;

  const undoable =
    canUndo &&
    Boolean(creditsBurned) &&
    isUndoWindowOpen(creditsBurnedAt);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2">
      {serviceName ? (
        <span className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--ozer-accent)]">
          {serviceName}
        </span>
      ) : null}
      {creditsBurned ? (
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          {creditsBurned} credit{creditsBurned === 1 ? '' : 's'} used
        </span>
      ) : null}
      {undoable ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                await undoTaskRetainerBurnAction({
                  accountId,
                  accountSlug,
                  taskId,
                });
                toast.success('Credits restored');
                onUndone?.();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Could not undo credit burn',
                );
              }
            });
          }}
        >
          <Undo2 className="mr-1 h-3.5 w-3.5" />
          Undo
        </Button>
      ) : null}
    </div>
  );
}
