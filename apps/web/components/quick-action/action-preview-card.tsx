'use client';

import Link from 'next/link';

import { Gauge, ListTodo } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { ProposedQuickAction } from '~/lib/quick-action/types';

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date';
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

type Props = {
  action: ProposedQuickAction;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
};

export function ActionPreviewCard(props: Props) {
  const { action, onConfirm, onCancel, confirming } = props;
  const preview = action.preview;

  if (preview.type === 'create_task') {
    return (
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
          <ListTodo className="h-4 w-4 text-[var(--ozer-accent)]" />
          Create task
        </div>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-[var(--workspace-shell-text)]/50">Workspace</dt>
            <dd className="text-[var(--workspace-shell-text)]">{preview.workspaceName}</dd>
          </div>
          <div>
            <dt className="text-[var(--workspace-shell-text)]/50">Title</dt>
            <dd className="font-medium text-[var(--workspace-shell-text)]">{preview.title}</dd>
          </div>
          {preview.notes ? (
            <div>
              <dt className="text-[var(--workspace-shell-text)]/50">Notes</dt>
              <dd className="whitespace-pre-wrap text-[var(--workspace-shell-text)]/90">{preview.notes}</dd>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[var(--workspace-shell-text)]/50">Due</dt>
              <dd className="text-[var(--workspace-shell-text)]">{formatDueDate(preview.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-[var(--workspace-shell-text)]/50">Priority</dt>
              <dd className="capitalize text-[var(--workspace-shell-text)]">{preview.priority}</dd>
            </div>
          </div>
          {preview.projectName || preview.clientName ? (
            <div>
              <dt className="text-[var(--workspace-shell-text)]/50">Linked to</dt>
              <dd className="text-[var(--workspace-shell-text)]">
                {preview.projectName ?? preview.clientName}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {confirming ? 'Creating…' : 'Confirm'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
        <Gauge className="h-4 w-4 text-[var(--ozer-accent)]" />
        Run PageSpeed scan
      </div>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[var(--workspace-shell-text)]/50">Workspace</dt>
          <dd className="text-[var(--workspace-shell-text)]">{preview.workspaceName}</dd>
        </div>
        <div>
          <dt className="text-[var(--workspace-shell-text)]/50">Project</dt>
          <dd className="font-medium text-[var(--workspace-shell-text)]">{preview.projectName}</dd>
        </div>
        <div>
          <dt className="text-[var(--workspace-shell-text)]/50">Domain</dt>
          <dd className="text-[var(--workspace-shell-text)]/90">{preview.domain}</dd>
        </div>
      </dl>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
        >
          {confirming ? 'Starting…' : 'Confirm'}
        </Button>
      </div>
    </div>
  );
}

export function QuickActionResultLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="text-sm font-medium text-[var(--ozer-accent)] underline-offset-2 hover:underline"
    >
      {props.label}
    </Link>
  );
}
