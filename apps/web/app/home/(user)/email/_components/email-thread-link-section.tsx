'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Link2, Loader2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';
import { toast } from '@kit/ui/sonner';

import {
  loadTaskAssignmentOptionsForWorkspace,
  type TaskAssignmentOption,
} from '~/home/(user)/_lib/actions/task-actions';
import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';

import { emailApiFetch } from '../_lib/email-api';
import type { EmailThreadLink, EmailWorkspaceOption } from '../_lib/types';

const panelClass =
  'rounded-xl border border-white/10 bg-[#0B132B]/60';

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
    link.projectId
      ? link.projectId
      : link.clientId
        ? link.clientId
        : 'none',
  );
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const currentLabel = useMemo(() => linkLabel(link), [link]);

  useEffect(() => {
    setWorkspaceId(link.accountId ?? '');
    setAssignTo(
      link.projectId
        ? link.projectId
        : link.clientId
          ? link.clientId
          : 'none',
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
    <div className={cn(panelClass, 'p-3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-[var(--keel-teal)]" />
            <p className="text-sm font-medium text-white">Client / project</p>
          </div>
          {link.linked && currentLabel ? (
            <p className="mt-1 truncate text-xs text-zinc-400">
              {currentLabel}
              {link.accountName ? ` · ${link.accountName}` : ''}
              {link.linkSource === 'auto' ? ' · auto-linked' : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Link this thread to a workspace client or project.
            </p>
          )}
        </div>

        {link.linked ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-zinc-400 hover:bg-white/5 hover:text-white"
            disabled={pending}
            onClick={() => saveLink(true)}
            aria-label="Remove link"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">Workspace</Label>
          <Select
            value={workspaceId || 'none'}
            onValueChange={(value) => {
              setWorkspaceId(value === 'none' ? '' : value);
              setAssignTo('none');
            }}
          >
            <SelectTrigger className="border-white/10 bg-[#0B132B] text-white">
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
          <Label className="text-xs text-zinc-400">Client or project</Label>
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
          className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
          disabled={
            pending ||
            !workspaceId ||
            assignTo === 'none' ||
            optionsLoading
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
    </div>
  );
}
