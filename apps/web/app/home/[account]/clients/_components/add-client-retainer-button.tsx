'use client';

import { useState } from 'react';

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
import { cn } from '@kit/ui/utils';

import {
  type ClientRetainerProjectChoice,
  projectRetainerHref,
} from '~/lib/retainers/client-retainer-summary';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { CreateClientProjectDialog } from './create-client-project-control';

export function AddClientRetainerButton({
  accountId,
  accountSlug,
  clientId,
  clientName,
  choices,
  canEdit,
  onViewProjects,
}: {
  accountId: string;
  accountSlug: string;
  clientId: string;
  clientName?: string;
  choices: ClientRetainerProjectChoice[];
  canEdit: boolean;
  onViewProjects: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    choices[0]?.projectId ?? null,
  );

  if (!canEdit) return null;

  const selected = choices.find((row) => row.projectId === selectedId) ?? null;

  function openProject(choice: ClientRetainerProjectChoice) {
    setOpen(false);
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
          if (next) {
            setSelectedId(choices[0]?.projectId ?? null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" size="sm" data-test="add-client-retainer">
            Add retainer
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add retainer</DialogTitle>
            <DialogDescription>
              Choose a project. Plans are attached and managed on the project,
              not here.
            </DialogDescription>
          </DialogHeader>

          {choices.length === 0 ? (
            <div className="space-y-3">
              <p className={`text-sm ${workspaceTextMuted}`}>
                No projects yet. Create one or open Projects, then attach the
                plan there.
              </p>
              <div className="flex flex-wrap gap-2">
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    onViewProjects();
                  }}
                >
                  View projects
                </Button>
              </div>
            </div>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-auto">
              {choices.map((row) => {
                const active = row.projectId === selectedId;
                return (
                  <li key={row.projectId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.projectId)}
                      className={cn(
                        'w-full rounded-md border px-3 py-2.5 text-left',
                        active
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                          : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]',
                      )}
                      data-test="add-client-retainer-project"
                    >
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {row.projectTitle}
                      </p>
                      <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
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

          {choices.length > 0 ? (
            <DialogFooter>
              <Button
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (selected) openProject(selected);
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <CreateClientProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        clientId={clientId}
        clientName={clientName}
        projectDetailPathBuilder={(projectId) =>
          projectRetainerHref(accountSlug, projectId, { attach: true })
        }
        onSuccess={() => setCreateOpen(false)}
      />
    </>
  );
}
