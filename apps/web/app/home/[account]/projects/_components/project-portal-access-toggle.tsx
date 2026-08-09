'use client';

import { useState, useTransition } from 'react';

import { Globe } from 'lucide-react';

import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { updateJob } from '../_lib/server/server-actions';

export function ProjectPortalAccessToggle(props: {
  accountId: string;
  jobId: string;
  hasClient: boolean;
  initialPortalVisible: boolean;
  canManage: boolean;
  compact?: boolean;
}) {
  const [portalVisible, setPortalVisible] = useState(
    props.initialPortalVisible,
  );
  const [pending, startTransition] = useTransition();

  const disabled = !props.canManage || !props.hasClient || pending;

  function toggle(checked: boolean) {
    const previous = portalVisible;
    setPortalVisible(checked);
    startTransition(async () => {
      try {
        await updateJob({
          accountId: props.accountId,
          jobId: props.jobId,
          portal_visible: checked,
        });
        toast.success(
          checked ? 'Project shared to portal' : 'Project hidden from portal',
        );
      } catch (err) {
        setPortalVisible(previous);
        toast.error(
          err instanceof Error ? err.message : 'Could not update portal access',
        );
      }
    });
  }

  if (props.compact) {
    // Not rendered at all when the viewer has no edit rights and the
    // project isn't already shared — avoids a confusing disabled control
    // for people who can't act on it anyway.
    if (!props.canManage && !portalVisible) return null;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => toggle(!portalVisible)}
        title={
          !props.hasClient
            ? 'Link a client to this project to enable portal access'
            : portalVisible
              ? 'Visible in the client portal — click to hide'
              : 'Not visible in the client portal — click to share'
        }
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          portalVisible
            ? 'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent)]/15 text-[var(--ozer-accent)]'
            : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]'
        }`}
      >
        <Globe className="h-3.5 w-3.5" />
        {portalVisible ? 'Shared with client portal' : 'Not shared with portal'}
      </button>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-4">
      <div className="flex gap-3">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        <div>
          <Label className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Client portal access
          </Label>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {props.hasClient
              ? 'When on, the linked client can view this project, its tasks, and comment from their portal.'
              : 'Link a client to this project to enable portal access.'}
          </p>
        </div>
      </div>
      <Switch
        checked={portalVisible}
        disabled={disabled}
        onCheckedChange={toggle}
      />
    </div>
  );
}
