'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Columns3, Frame } from 'lucide-react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Button } from '@kit/ui/button';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import type { CanvasGuestMode } from '~/home/[account]/projects/_components/job-project/job-project-canvas';
import type {
  JobBoardResult,
  JobBoardTask,
} from '~/home/[account]/projects/_lib/schema/project-phases.schema';
import { GuestProjectBoard } from '~/lib/projects/components/guest-project-board';
import type { ProjectGuestPermissions } from '~/lib/projects/project-guests.types';

import {
  loadGuestProjectBoardAction,
  openGuestProjectDocAction,
  prepareGuestFileUploadAction,
  registerGuestFileAction,
} from '../_lib/guest-canvas.actions';
import { GuestTaskSheet } from './guest-task-sheet';

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  /** Bumped when a task is edited on the canvas so the board re-reads it. */
  const [boardVersion, setBoardVersion] = useState(0);
  const { data: user } = useUser();

  const refreshBoard = useCallback(async () => {
    try {
      setBoard(await loadGuestProjectBoardAction({ accountId, projectId }));
      setBoardVersion((version) => version + 1);
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
      onOpenTask: setOpenTaskId,
      loadDoc: (docId) =>
        openGuestProjectDocAction({ accountId, projectId, docId }),
      createTask: permissions.create_task
        ? async ({ title }) => {
            const client = getSupabaseBrowserClient();
            const {
              data: { user: me },
            } = await client.auth.getUser();
            if (!me) throw new Error('Sign in required');
            const { data, error } = await client
              .from('tasks')
              .insert({
                title,
                project_id: projectId,
                account_id: accountId,
                user_id: me.id,
                status: 'todo',
                priority: 'medium',
              })
              .select('id')
              .single();
            if (error) throw new Error(error.message);
            return { id: String(data.id) };
          }
        : undefined,
      uploadFile: async (file) => {
        const { path, token } = await prepareGuestFileUploadAction({
          accountId,
          projectId,
          fileName: file.name,
        });
        const { error } = await getSupabaseBrowserClient()
          .storage.from(ACCOUNT_DOCS_BUCKET)
          .uploadToSignedUrl(path, token, file, {
            contentType: file.type || undefined,
          });
        if (error) throw error;
        return registerGuestFileAction({
          accountId,
          projectId,
          path,
          title: file.name.slice(0, 500),
          mimeType: file.type || null,
        });
      },
    }),
    [accountId, permissions.comment, permissions.create_task, projectId],
  );

  const openTask = openTaskId
    ? (Object.values(board?.tasksByPhase ?? {})
        .flat()
        .find((task) => task.id === openTaskId) ?? null)
    : null;
  const assigneeName = (() => {
    if (!openTask || !board) return null;
    const userId = openTask.user_id;
    const contactId = openTask.assignee_contact_id;
    return (
      board.members.find((member) => member.user_id === userId)?.name ??
      board.contactAssignees?.find((contact) => contact.id === contactId)
        ?.name ??
      null
    );
  })();

  const saveTask = (task: JobBoardTask) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            tasksByPhase: Object.fromEntries(
              Object.entries(prev.tasksByPhase).map(([key, list]) => [
                key,
                list.map((existing) =>
                  existing.id === task.id ? { ...existing, ...task } : existing,
                ),
              ]),
            ),
          }
        : prev,
    );
    setBoardVersion((version) => version + 1);
  };

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
          key={boardVersion}
          projectId={projectId}
          accountId={accountId}
          permissions={permissions}
          initialTasks={
            boardVersion > 0 && board
              ? Object.values(board.tasksByPhase).flat()
              : initialTasks
          }
        />
      </div>

      {view === 'canvas' ? (
        board ? (
          <JobProjectCanvas
            accountId={accountId}
            accountSlug={accountSlug}
            jobId={projectId}
            board={board}
            canEdit={permissions.edit_canvas}
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

      <GuestTaskSheet
        key={openTaskId ?? 'closed'}
        task={openTask}
        assigneeName={assigneeName}
        canEdit={
          permissions.edit_own_task &&
          Boolean(user?.id) &&
          openTask?.user_id === user?.id
        }
        onClose={() => setOpenTaskId(null)}
        onSaved={saveTask}
      />
    </div>
  );
}
