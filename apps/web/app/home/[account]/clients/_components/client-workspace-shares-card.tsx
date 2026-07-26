'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Check, Copy, Loader2, Share2, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  createClientWorkspaceShareAction,
  listClientWorkspaceSharesAction,
  revokeClientWorkspaceShareAction,
  updateClientWorkspaceShareAction,
} from '~/lib/clients/client-workspace-shares-actions';
import type {
  ClientWorkspaceShare,
  ShareCapabilities,
} from '~/lib/clients/client-workspace-shares.service';

const MODULES: Array<{
  key: keyof ShareCapabilities;
  label: string;
}> = [
  { key: 'canSupport', label: 'Support' },
  { key: 'canContacts', label: 'Contacts' },
  { key: 'canProjects', label: 'Projects' },
  { key: 'canDocs', label: 'Docs' },
  { key: 'canFinance', label: 'Finance' },
  { key: 'canPortal', label: 'Portal' },
];

const DEFAULT_CAPS: ShareCapabilities = {
  canSupport: true,
  canContacts: false,
  canProjects: false,
  canDocs: false,
  canFinance: false,
  canPortal: false,
};

function ModuleToggles({
  value,
  onChange,
  disabled,
}: {
  value: ShareCapabilities;
  onChange: (next: ShareCapabilities) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {MODULES.map((module) => (
        <label
          key={module.key}
          className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text)]"
        >
          <Checkbox
            checked={value[module.key]}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({ ...value, [module.key]: checked === true })
            }
          />
          {module.label}
        </label>
      ))}
    </div>
  );
}

function statusLabel(status: ClientWorkspaceShare['status']) {
  if (status === 'pending') return 'Pending';
  if (status === 'active') return 'Active';
  return status;
}

export function ClientWorkspaceSharesCard({
  accountId,
  clientOrgId,
  clientId = null,
  accountSlug,
  compact = false,
}: {
  accountId: string;
  clientOrgId: string;
  clientId?: string | null;
  accountSlug: string;
  compact?: boolean;
}) {
  const [shares, setShares] = useState<ClientWorkspaceShare[] | null>(null);
  const [email, setEmail] = useState('');
  const [caps, setCaps] = useState<ShareCapabilities>(DEFAULT_CAPS);
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const rows = await listClientWorkspaceSharesAction({
          accountId,
          clientOrgId,
        });
        setShares(rows);
      } catch {
        setShares([]);
      }
    });
  }, [accountId, clientOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  function invite() {
    startTransition(async () => {
      try {
        const result = await createClientWorkspaceShareAction({
          accountId,
          accountSlug,
          clientOrgId,
          clientId,
          invitedEmail: email.trim() || null,
          capabilities: caps,
        });
        setLastAcceptUrl(result.acceptUrl);
        setEmail('');
        toast.success(
          result.share.invitedEmail
            ? 'Invite sent'
            : 'Share link created — copy and send it',
        );
        load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create share',
        );
      }
    });
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied'),
      () => toast.error('Could not copy link'),
    );
  }

  function revoke(shareId: string) {
    startTransition(async () => {
      try {
        await revokeClientWorkspaceShareAction({
          accountId,
          accountSlug,
          shareId,
        });
        toast.success('Share revoked');
        load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not revoke share',
        );
      }
    });
  }

  function saveCaps(share: ClientWorkspaceShare, next: ShareCapabilities) {
    startTransition(async () => {
      try {
        await updateClientWorkspaceShareAction({
          accountId,
          accountSlug,
          shareId: share.id,
          capabilities: next,
        });
        toast.success('Access updated');
        load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update access',
        );
      }
    });
  }

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4'
          : 'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4'
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Share with workspace
            </h3>
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Invite another Ozer workspace by email or link. Choose which
              modules they can access.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
            <Label htmlFor="share-email" className="text-xs">
              Invite email (optional)
            </Label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="partner@agency.com"
              disabled={pending}
            />
            <ModuleToggles value={caps} onChange={setCaps} disabled={pending} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={invite}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Create invite
              </Button>
            </div>
            {lastAcceptUrl ? (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  readOnly
                  value={lastAcceptUrl}
                  className="text-xs"
                  onFocus={(event) => event.target.select()}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyUrl(lastAcceptUrl)}
                  aria-label="Copy invite link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>

          {pending && !shares ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Loading…
            </p>
          ) : shares && shares.length > 0 ? (
            <ul className="space-y-3">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                        {share.guestAccountName ??
                          share.invitedEmail ??
                          'Pending invite'}
                      </p>
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {statusLabel(share.status)}
                        {share.guestAccountSlug
                          ? ` · ${share.guestAccountSlug}`
                          : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      className="text-red-300 hover:text-red-200"
                      onClick={() => revoke(share.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </div>
                  <div className="mt-2">
                    <ModuleToggles
                      value={share.capabilities}
                      disabled={pending}
                      onChange={(next) => saveCaps(share, next)}
                    />
                  </div>
                  {share.status === 'pending' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() =>
                        copyUrl(
                          `${typeof window !== 'undefined' ? window.location.origin : ''}/join/client-share/${share.inviteToken}`,
                        )
                      }
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Copy invite link
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              No shared workspaces yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
