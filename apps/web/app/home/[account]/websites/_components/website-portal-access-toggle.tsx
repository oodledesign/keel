'use client';

import { useState, useTransition } from 'react';

import { Globe } from 'lucide-react';

import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { setWebsitePortalVisible } from '../_lib/server/server-actions';

export function WebsitePortalAccessToggle(props: {
  accountId: string;
  websiteId: string;
  hasClient: boolean;
  initialPortalVisible: boolean;
  canManage: boolean;
  compact?: boolean;
  onChanged?: (visible: boolean) => void;
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
        await setWebsitePortalVisible({
          accountId: props.accountId,
          websiteId: props.websiteId,
          portal_visible: checked,
        });
        props.onChanged?.(checked);
        toast.success(
          checked
            ? 'Website shared to the client portal'
            : 'Website hidden from the client portal',
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
    if (!props.canManage && !portalVisible) return null;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => toggle(!portalVisible)}
        title={
          !props.hasClient
            ? 'Link a client to this website to enable portal access'
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
        {portalVisible ? 'Shared with portal' : 'Not on portal'}
      </button>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-4">
      <div className="flex gap-3">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        <div>
          <Label className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Client portal
          </Label>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {props.hasClient
              ? 'When on, the linked client can see this site, CMS and live links, and hosting notes in their portal.'
              : 'Link a CRM client to this website to share it on their portal.'}
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
