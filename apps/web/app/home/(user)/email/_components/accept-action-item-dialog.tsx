'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  loadTaskAssignmentOptions,
  loadTaskAssignmentOptionsForWorkspace,
  type TaskAssignmentOption,
} from '~/home/(user)/_lib/actions/task-actions';
import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';

import type {
  EmailActionItemRow,
  EmailThreadLink,
  EmailWorkspaceOption,
} from '../_lib/types';
import { emailApiFetch } from '../_lib/email-api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionItem: EmailActionItemRow | null;
  threadLink?: EmailThreadLink;
  workspaces: EmailWorkspaceOption[];
  onAccepted: () => void;
};

type Destination = 'personal' | 'workspace';

export function AcceptActionItemDialog({
  open,
  onOpenChange,
  actionItem,
  threadLink,
  workspaces,
  onAccepted,
}: Props) {
  const [destination, setDestination] = useState<Destination>('personal');
  const [workspaceId, setWorkspaceId] = useState('');
  const [assignTo, setAssignTo] = useState('none');
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setDestination('personal');
      setWorkspaceId('');
      setAssignTo('none');
      setOptions([]);
      return;
    }

    const linkedAccountId =
      actionItem?.account_id ?? threadLink?.accountId ?? '';
    const linkedAssignTo =
      actionItem?.project_id ??
      actionItem?.client_id ??
      threadLink?.projectId ??
      threadLink?.clientId ??
      'none';

    if (linkedAccountId && linkedAssignTo !== 'none') {
      setDestination('workspace');
      setWorkspaceId(linkedAccountId);
      setAssignTo(linkedAssignTo);
    } else {
      setDestination('personal');
      setWorkspaceId('');
      setAssignTo('none');
    }
  }, [open, actionItem, threadLink]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (destination === 'personal') {
      void loadPersonalOptions();
      return;
    }

    if (workspaceId) {
      void loadWorkspaceOptions(workspaceId);
    } else {
      setOptions([]);
      setAssignTo('none');
    }
  }, [open, destination, workspaceId]);

  async function loadPersonalOptions() {
    setOptionsLoading(true);
    try {
      const data = await loadTaskAssignmentOptions();
      setOptions(data);
    } finally {
      setOptionsLoading(false);
    }
  }

  async function loadWorkspaceOptions(accountId: string) {
    setOptionsLoading(true);
    try {
      const data = await loadTaskAssignmentOptionsForWorkspace(accountId);
      setOptions(data);
    } finally {
      setOptionsLoading(false);
    }
  }

  function handleAccept() {
    if (!actionItem) {
      return;
    }

    const selected = options.find((option) => option.id === assignTo);
    const projectId =
      selected?.type === 'project'
        ? selected.id
        : actionItem.project_id ?? threadLink?.projectId ?? null;
    const clientId =
      selected?.type === 'client'
        ? selected.id
        : actionItem.client_id ?? threadLink?.clientId ?? null;

    if (destination === 'workspace' && !projectId && !clientId) {
      toast.error('Choose a workspace project or client for this task.');
      return;
    }

    startTransition(async () => {
      try {
        await emailApiFetch<{ actionItem: EmailActionItemRow; taskId: string }>(
          `/api/email-actions/${actionItem.id}/accept`,
          {
            method: 'POST',
            body: JSON.stringify({
              projectId,
              clientId,
            }),
          },
        );
        toast.success('Added to your tasks');
        onOpenChange(false);
        onAccepted();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not accept item',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to tasks</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {actionItem?.title ?? 'Choose where this to-do should live.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">Destination</Label>
            <Select
              value={destination}
              onValueChange={(value) =>
                setDestination(value as Destination)
              }
            >
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                <SelectItem value="personal">Personal tasks</SelectItem>
                <SelectItem value="workspace">Workspace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {destination === 'workspace' ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">Workspace</Label>
              <Select value={workspaceId || 'none'} onValueChange={setWorkspaceId}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Choose workspace" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              {destination === 'workspace'
                ? 'Project or client'
                : 'Optional link (project, client, or area)'}
            </Label>
            <TaskAssignmentCombobox
              value={assignTo}
              onValueChange={setAssignTo}
              options={options.filter((option) => option.type !== 'area')}
              isWorkspaceMode={destination === 'workspace'}
              placeholder={
                optionsLoading ? 'Loading…' : 'Select project or client'
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="ozer-gradient-btn text-[var(--ozer-white)]"
            onClick={handleAccept}
            disabled={pending || !actionItem}
          >
            {pending ? 'Adding…' : 'Accept'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
