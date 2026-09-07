'use client';

import { useState, useTransition } from 'react';

import { Globe, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { setProjectPortalAccess } from '../_lib/server/server-actions';
import { ProjectPortalAccessPanel } from './project-portal-access-panel';

function initialCompactLabel(props: {
  portalVisible: boolean;
  restrictContacts?: boolean;
}) {
  if (!props.portalVisible) return 'Not shared with portal';
  if (props.restrictContacts) return 'Shared with specific contacts';
  return 'Shared with client portal';
}

export function ProjectPortalAccessToggle(props: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  hasClient: boolean;
  initialPortalVisible: boolean;
  initialRestrictContacts?: boolean;
  canManage: boolean;
  compact?: boolean;
}) {
  const [portalVisible, setPortalVisible] = useState(
    props.initialPortalVisible,
  );
  const [manageOpen, setManageOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);

  const disabled = !props.canManage || !props.hasClient || pending;

  function toggle(checked: boolean) {
    const previous = portalVisible;
    setPortalVisible(checked);
    startTransition(async () => {
      try {
        await setProjectPortalAccess({
          accountId: props.accountId,
          accountSlug: props.accountSlug,
          jobId: props.jobId,
          portalVisible: checked,
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

  const manageDialog = (
    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Client portal access</DialogTitle>
        </DialogHeader>
        <ProjectPortalAccessPanel
          accountId={props.accountId}
          accountSlug={props.accountSlug}
          jobId={props.jobId}
          hasClient={props.hasClient}
          canManage={props.canManage}
          initialPortalVisible={portalVisible}
          onSummaryChange={(next, isVisible) => {
            setSummary(next);
            setPortalVisible(isVisible);
          }}
        />
      </DialogContent>
    </Dialog>
  );

  if (props.compact) {
    if (!props.canManage && !portalVisible) return null;

    const label =
      summary ??
      initialCompactLabel({
        portalVisible,
        restrictContacts: props.initialRestrictContacts,
      });

    return (
      <>
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggle(!portalVisible)}
            data-test="project-portal-share-toggle"
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
            {label}
          </button>
          {props.canManage && props.hasClient ? (
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              data-test="project-portal-who-can-see"
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] px-2.5 py-1 text-xs font-medium text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <Users className="h-3.5 w-3.5" />
              Who can see this
            </button>
          ) : null}
        </div>
        {manageDialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
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
      {props.canManage && props.hasClient ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)]"
          onClick={() => setManageOpen(true)}
        >
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Choose which contacts can see this project
        </Button>
      ) : null}
      {manageDialog}
    </div>
  );
}
