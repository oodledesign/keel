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
}) {
  const [portalVisible, setPortalVisible] = useState(
    props.initialPortalVisible,
  );
  const [pending, startTransition] = useTransition();

  const disabled = !props.canManage || !props.hasClient || pending;

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
        onCheckedChange={(checked) => {
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
                checked
                  ? 'Project shared to portal'
                  : 'Project hidden from portal',
              );
            } catch (err) {
              setPortalVisible(previous);
              toast.error(
                err instanceof Error
                  ? err.message
                  : 'Could not update portal access',
              );
            }
          });
        }}
      />
    </div>
  );
}
