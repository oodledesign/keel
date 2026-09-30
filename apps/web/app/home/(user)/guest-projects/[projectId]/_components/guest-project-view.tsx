'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Columns3, Frame } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { CanvasGuestMode } from '~/home/[account]/projects/_components/job-project/job-project-canvas';
import type { JobBoardResult } from '~/home/[account]/projects/_lib/schema/project-phases.schema';
import { GuestProjectBoard } from '~/lib/projects/components/guest-project-board';
import type { ProjectGuestPermissions } from '~/lib/projects/project-guests.types';

import {
  loadGuestProjectBoardAction,
  openGuestProjectDocAction,
} from '../_lib/guest-canvas.actions';

const JobProjectCanvas = dynamic(
  () =>
    import('~/home/[account]/projects/_components/job-project/job-project-canvas').then(
      (mod) => mod.JobProjectCanvas,
    ),
  { ssr: false, loading: () => <CanvasPlaceholder /> },
);

type View = 'board' | 'canvas';

const VIEWS: Array<{ key: View; label: string; icon: typeof Columns3 }> = [
  { key: 'board', label: 'Board', icon: Columns3 },
  { key: 'canvas', label: 'Canvas', icon: Frame },
];

function CanvasPlaceholder() {
  return (
    <div className="h-[calc(100vh-15rem)] min-h-[560px] animate-pulse rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40" />
  );
}

export function GuestProjectView({
  projectId,
  accountId,
  accountSlug,
  permissions,
  initialTasks,
}: {
  projectId: string;
  accountId: string;
  accountSlug: string;
  permissions: ProjectGuestPermissions;
  initialTasks: Array<Record<string, unknown>>;
}) {
  const [view, setView] = useState<View>('board');
  const [board, setBoard] = useState<JobBoardResult | null>(null);
  const [boardError, setBoardError] = useState(false);

  const refreshBoard = useCallback(async () => {
    try {
      setBoard(await loadGuestProjectBoardAction({ accountId, projectId }));
      setBoardError(false);
    } catch {
      setBoardError(true);
    }
  }, [accountId, projectId]);

  const selectView = (next: View) => {
    setView(next);
    if (next === 'canvas') void refreshBoard();
  };

  const guest = useMemo<CanvasGuestMode>(
    () => ({
      canComment: permissions.comment,
      onOpenTask: () => setView('board'),
      loadDoc: (docId) =>
        openGuestProjectDocAction({ accountId, projectId, docId }),
    }),
    [accountId, permissions.comment, projectId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-[color:var(--workspace-shell-border)] pb-3">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectView(key)}
            aria-pressed={view === key}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === key
                ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className={view === 'board' ? undefined : 'hidden'}>
        <GuestProjectBoard
          projectId={projectId}
          accountId={accountId}
          permissions={permissions}
          initialTasks={initialTasks}
        />
      </div>

      {view === 'canvas' ? (
        board ? (
          <JobProjectCanvas
            accountId={accountId}
            accountSlug={accountSlug}
            jobId={projectId}
            board={board}
            canEdit={false}
            onBoardChange={setBoard}
            onRefreshBoard={refreshBoard}
            guest={guest}
          />
        ) : boardError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] text-sm text-[var(--workspace-shell-text-muted)]">
            Couldn&apos;t load the canvas.
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refreshBoard()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <CanvasPlaceholder />
        )
      ) : null}
    </div>
  );
}
