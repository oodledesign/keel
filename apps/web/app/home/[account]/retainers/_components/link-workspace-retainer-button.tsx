'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { notifyClientSubscriptionsChanged } from '~/home/[account]/_lib/client-subscriptions-events';
import { CreateClientProjectDialog } from '~/home/[account]/clients/_components/create-client-project-control';
import { projectRetainerHref } from '~/lib/retainers/client-retainer-summary';
import type {
  WorkspaceRetainerProjectChoice,
  WorkspaceRetainerRow,
} from '~/lib/retainers/workspace-retainers';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { linkWorkspaceRetainerToProjectAction } from '../_lib/server/workspace-retainers-actions';

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function LinkWorkspaceRetainerTrigger({
  onClick,
  children,
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      data-test="link-workspace-retainer"
    >
      {children ?? 'Link to project'}
    </Button>
  );
}

export function LinkWorkspaceRetainerDialog({
  accountId,
  accountSlug,
  row,
  projects,
  open,
  onOpenChange,
}: {
  accountId: string;
  accountSlug: string;
  row: WorkspaceRetainerRow | null;
  projects: WorkspaceRetainerProjectChoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createClient, setCreateClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const clientId = row?.clientId ?? null;
  const clientName = row?.clientName ?? 'Client';
  const subscriptionId = row?.subscriptionId ?? null;

  const clientProjects = useMemo(
    () =>
      projects.filter((project) =>
        clientId ? project.clientId === clientId : false,
      ),
    [projects, clientId],
  );

  const linkableProjects = useMemo(
    () => clientProjects.filter((project) => !project.hasPlan),
    [clientProjects],
  );

  const selectedProject =
    linkableProjects.find(
      (project) => project.projectId === selectedProjectId,
    ) ?? null;

  function reset() {
    setSelectedProjectId(null);
  }

  function openCreateProject() {
    if (!clientId) return;
    setCreateClient({ id: clientId, name: clientName });
    onOpenChange(false);
    setCreateOpen(true);
  }

  function submit() {
    if (!selectedProject || !subscriptionId) return;

    startTransition(async () => {
      try {
        const result = await linkWorkspaceRetainerToProjectAction({
          accountId,
          accountSlug,
          subscriptionId,
          projectId: selectedProject.projectId,
        });
        toast.success('Retainer linked to project');
        notifyClientSubscriptionsChanged();
        onOpenChange(false);
        reset();
        router.refresh();
        router.push(projectRetainerHref(accountSlug, result.projectId));
      } catch (error) {
        toast.error(errorMessage(error, 'Could not link retainer'));
      }
    });
  }

  return (
    <>
      {row && subscriptionId && clientId ? (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            if (!next) reset();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Link to project</DialogTitle>
              <DialogDescription>
                Attach this retainer to a {clientName} project so you can manage
                credits and edit it from the project.
              </DialogDescription>
            </DialogHeader>

            {clientProjects.length === 0 ? (
              <div className="space-y-3">
                <p className={`text-sm ${workspaceTextMuted}`}>
                  {clientName} has no projects yet. Create one, then link this
                  retainer.
                </p>
                <Button type="button" size="sm" onClick={openCreateProject}>
                  Create project
                </Button>
              </div>
            ) : linkableProjects.length === 0 ? (
              <div className="space-y-3">
                <p className={`text-sm ${workspaceTextMuted}`}>
                  Every project for {clientName} already has a live retainer.
                  Open a project to manage it, or create another project.
                </p>
                <Button type="button" size="sm" onClick={openCreateProject}>
                  Create project
                </Button>
              </div>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-auto">
                {clientProjects.map((project) => {
                  const blocked = project.hasPlan;
                  const active = project.projectId === selectedProjectId;
                  return (
                    <li key={project.projectId}>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (!blocked) setSelectedProjectId(project.projectId);
                        }}
                        className={cn(
                          'w-full rounded-md border px-3 py-2.5 text-left',
                          blocked && 'cursor-not-allowed opacity-60',
                          active
                            ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                            : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]',
                        )}
                        data-test="link-workspace-retainer-project"
                      >
                        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                          {project.projectTitle}
                        </p>
                        <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                          {blocked
                            ? 'Already has a retainer'
                            : 'Available to link'}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {linkableProjects.length > 0 ? (
              <DialogFooter>
                <Button
                  type="button"
                  disabled={!selectedProject || pending}
                  onClick={submit}
                  data-test="link-workspace-retainer-confirm"
                >
                  {pending ? 'Linking…' : 'Link retainer'}
                </Button>
              </DialogFooter>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {createClient ? (
        <CreateClientProjectDialog
          open={createOpen}
          onOpenChange={(next) => {
            setCreateOpen(next);
            if (!next) setCreateClient(null);
          }}
          accountId={accountId}
          accountSlug={accountSlug}
          clientId={createClient.id}
          clientName={createClient.name}
          projectDetailPathBuilder={(projectId) =>
            projectRetainerHref(accountSlug, projectId)
          }
          onSuccess={() => {
            setCreateOpen(false);
            setCreateClient(null);
            reset();
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
