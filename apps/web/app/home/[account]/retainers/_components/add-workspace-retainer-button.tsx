'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { CreateClientProjectDialog } from '~/home/[account]/clients/_components/create-client-project-control';
import { projectRetainerHref } from '~/lib/retainers/client-retainer-summary';
import type {
  WorkspaceRetainerClientChoice,
  WorkspaceRetainerProjectChoice,
} from '~/lib/retainers/workspace-retainers';
import { workspaceTextMuted } from '~/lib/workspace-ui';

export function AddWorkspaceRetainerButton({
  accountId,
  accountSlug,
  clients,
  projects,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  clients: WorkspaceRetainerClientChoice[];
  projects: WorkspaceRetainerProjectChoice[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((row) =>
      row.clientName.toLowerCase().includes(query),
    );
  }, [clientQuery, clients]);

  const clientProjects = useMemo(
    () =>
      projects.filter((row) =>
        selectedClientId ? row.clientId === selectedClientId : false,
      ),
    [projects, selectedClientId],
  );

  const selectedClient =
    clients.find((row) => row.clientId === selectedClientId) ?? null;
  const selectedProject =
    clientProjects.find((row) => row.projectId === selectedProjectId) ?? null;

  if (!canEdit) return null;

  function reset() {
    setClientQuery('');
    setSelectedClientId(null);
    setSelectedProjectId(null);
  }

  function openProject(choice: WorkspaceRetainerProjectChoice) {
    setOpen(false);
    reset();
    router.push(
      projectRetainerHref(accountSlug, choice.projectId, {
        attach: !choice.hasPlan,
      }),
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" size="sm" data-test="add-workspace-retainer">
            Add retainer
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add retainer</DialogTitle>
            <DialogDescription>
              Pick a client and project. Plans are attached and managed on the
              project.
            </DialogDescription>
          </DialogHeader>

          {clients.length === 0 ? (
            <div className="space-y-3">
              <p className={`text-sm ${workspaceTextMuted}`}>
                Add a client first, then attach a retainer on one of their
                projects.
              </p>
              <Button asChild size="sm">
                <a
                  href={pathsConfig.app.accountClients.replace(
                    '[account]',
                    accountSlug,
                  )}
                >
                  View clients
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                  Client
                </p>
                <Input
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="Search clients"
                  className="border-[color:var(--workspace-shell-border)]"
                />
                <ul className="max-h-40 space-y-2 overflow-auto">
                  {filteredClients.length === 0 ? (
                    <li className={`px-1 text-sm ${workspaceTextMuted}`}>
                      No clients match that search.
                    </li>
                  ) : (
                    filteredClients.map((row) => {
                      const active = row.clientId === selectedClientId;
                      return (
                        <li key={row.clientId}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClientId(row.clientId);
                              setSelectedProjectId(null);
                            }}
                            className={cn(
                              'w-full rounded-md border px-3 py-2 text-left',
                              active
                                ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                                : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]',
                            )}
                            data-test="add-workspace-retainer-client"
                          >
                            <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                              {row.clientName}
                            </p>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              {selectedClient ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                    Project
                  </p>
                  {clientProjects.length === 0 ? (
                    <div className="space-y-3">
                      <p className={`text-sm ${workspaceTextMuted}`}>
                        {selectedClient.clientName} has no projects yet. Create
                        one, then attach the plan there.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setOpen(false);
                          setCreateOpen(true);
                        }}
                      >
                        Create project
                      </Button>
                    </div>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-auto">
                      {clientProjects.map((row) => {
                        const active = row.projectId === selectedProjectId;
                        return (
                          <li key={row.projectId}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedProjectId(row.projectId)
                              }
                              className={cn(
                                'w-full rounded-md border px-3 py-2.5 text-left',
                                active
                                  ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                                  : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]',
                              )}
                              data-test="add-workspace-retainer-project"
                            >
                              <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                                {row.projectTitle}
                              </p>
                              <p
                                className={`mt-0.5 text-xs ${workspaceTextMuted}`}
                              >
                                {row.hasPlan
                                  ? 'Has a retainer — open to manage'
                                  : 'No plan yet — open to attach'}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {selectedClient && clientProjects.length > 0 ? (
            <DialogFooter>
              <Button
                type="button"
                disabled={!selectedProject}
                onClick={() => {
                  if (selectedProject) openProject(selectedProject);
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {selectedClient ? (
        <CreateClientProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          accountId={accountId}
          accountSlug={accountSlug}
          clientId={selectedClient.clientId}
          clientName={selectedClient.clientName}
          projectDetailPathBuilder={(projectId) =>
            projectRetainerHref(accountSlug, projectId, { attach: true })
          }
          onSuccess={() => {
            setCreateOpen(false);
            reset();
          }}
        />
      ) : null}
    </>
  );
}
