'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { ChevronDown, Link2, Loader2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';
import {
  type TaskAssignmentOption,
  loadTaskAssignmentOptionsForWorkspace,
} from '~/home/(user)/_lib/actions/task-actions';

import { emailApiFetch } from '../_lib/email-api';
import type { EmailThreadLink, EmailWorkspaceOption } from '../_lib/types';

const panelClass =
  'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60';

type Props = {
  threadId: string;
  link: EmailThreadLink;
  workspaces: EmailWorkspaceOption[];
  onUpdated: (link: EmailThreadLink) => void;
};

function linkLabel(link: EmailThreadLink): string | null {
  if (link.projectName) {
    return link.projectName;
  }

  if (link.clientName) {
    return link.clientName;
  }

  return null;
}

export function EmailThreadLinkSection({
  threadId,
  link,
  workspaces,
  onUpdated,
}: Props) {
  const [workspaceId, setWorkspaceId] = useState(link.accountId ?? '');
  const [assignTo, setAssignTo] = useState(
    link.projectId ? link.projectId : link.clientId ? link.clientId : 'none',
  );
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(() => !link.linked);

  const currentLabel = useMemo(() => linkLabel(link), [link]);

  useEffect(() => {
    setOpen(!link.linked);
  }, [link.linked, threadId]);

  useEffect(() => {
    setWorkspaceId(link.accountId ?? '');
    setAssignTo(
      link.projectId ? link.projectId : link.clientId ? link.clientId : 'none',
    );
  }, [link.accountId, link.clientId, link.projectId, threadId]);

  useEffect(() => {
    if (!workspaceId) {
      setOptions([]);
      setAssignTo('none');
      return;
    }

    let cancelled = false;
    setOptionsLoading(true);

    void loadTaskAssignmentOptionsForWorkspace(workspaceId).then((data) => {
      if (cancelled) {
        return;
      }

      setOptions(data);
      setOptionsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function saveLink(clear = false) {
    startTransition(async () => {
      try {
        const selected = options.find((option) => option.id === assignTo);
        const data = await emailApiFetch<{ thread: { link: EmailThreadLink } }>(
          `/api/gmail/threads/${threadId}/link`,
          {
            method: 'PATCH',
            body: JSON.stringify(
              clear
                ? {
                    accountId: null,
                    clientId: null,
                    projectId: null,
                  }
                : {
                    accountId: workspaceId || null,
                    clientId: selected?.type === 'client' ? selected.id : null,
                    projectId:
                      selected?.type === 'project' ? selected.id : null,
                  },
            ),
          },
        );

        onUpdated(data.thread.link);
        toast.success(clear ? 'Link removed' : 'Thread linked');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update link',
        );
      }
    });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn(panelClass, 'overflow-hidden')}>
        <div className="flex items-start gap-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Client / project
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)] transition-transform',
                    open && 'rotate-180',
                  )}
                />
              </span>
              {link.linked && currentLabel ? (
                <span className="mt-1 block truncate text-xs text-[var(--workspace-shell-text-muted)]">
                  {currentLabel}
                  {link.accountName ? ` · ${link.accountName}` : ''}
                  {link.linkSource === 'auto' ? ' · auto-linked' : ''}
                </span>
              ) : !open ? (
                <span className="mt-1 block text-xs text-[var(--workspace-shell-text-muted)]">
                  Link this thread to a workspace client or project.
                </span>
              ) : null}
            </span>
          </CollapsibleTrigger>

          {link.linked ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-2 mr-1 shrink-0 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
              disabled={pending}
              onClick={(event) => {
                event.stopPropagation();
                saveLink(true);
              }}
              aria-label="Remove link"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <CollapsibleContent className="border-t border-[color:var(--workspace-shell-border)] px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                Workspace
              </Label>
              <Select
                value={workspaceId || 'none'}
                onValueChange={(value) => {
                  setWorkspaceId(value === 'none' ? '' : value);
                  setAssignTo('none');
                }}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select workspace</SelectItem>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                Client or project
              </Label>
              <TaskAssignmentCombobox
                value={assignTo}
                onValueChange={setAssignTo}
                options={options}
                isWorkspaceMode
                placeholder={
                  optionsLoading ? 'Loading…' : 'Select client or project'
                }
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              disabled={
                pending || !workspaceId || assignTo === 'none' || optionsLoading
              }
              onClick={() => saveLink(false)}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save link'
              )}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
