'use client';

import { useState, useTransition } from 'react';

import { Check, Copy, Link2, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import type {
  WebsitePortalShareScope,
  WebsiteShareLink,
  WebsiteShareScope,
} from '~/lib/websites/planning-types';

import {
  createWebsiteShare,
  revokeWebsiteShare,
  setWebsitePortalScope,
} from '../../_lib/server/site-studio-actions';

function publicShareUrl(token: string) {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/portal/websites/${encodeURIComponent(token)}`;
  }
  return `/portal/websites/${encodeURIComponent(token)}`;
}

const SHARE_SCOPES: Array<{ value: WebsiteShareScope; label: string }> = [
  { value: 'sitemap', label: 'Sitemap only' },
  { value: 'wireframes', label: 'Sitemap + wireframes' },
  { value: 'design', label: 'Sitemap + wireframes + design tokens' },
  { value: 'full', label: 'Full planning pack' },
];

const PORTAL_SCOPES: Array<{ value: WebsitePortalShareScope; label: string }> =
  [
    { value: 'off', label: 'Hidden from portal' },
    { value: 'sitemap', label: 'Sitemap' },
    { value: 'wireframes', label: 'Sitemap + wireframes' },
    { value: 'full', label: 'Full planning' },
  ];

type ExpiryPreset = 'never' | '7d' | '30d' | '90d';

const EXPIRY_PRESETS: Array<{ value: ExpiryPreset; label: string }> = [
  { value: 'never', label: 'No expiry' },
  { value: '7d', label: 'Expires in 7 days' },
  { value: '30d', label: 'Expires in 30 days' },
  { value: '90d', label: 'Expires in 90 days' },
];

function expiresAtFromPreset(preset: ExpiryPreset): string | null {
  if (preset === 'never') return null;
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  return `Expires ${new Date(expiresAt).toLocaleDateString('en-GB')}`;
}

export function WebsiteSharePanel({
  accountId,
  websiteId,
  accountSlug: _accountSlug,
  shares,
  portalScope,
  hasJob: _hasJob,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  accountSlug: string;
  shares: WebsiteShareLink[];
  portalScope: WebsitePortalShareScope;
  hasJob: boolean;
  canEdit: boolean;
}) {
  const [shareScope, setShareScope] = useState<WebsiteShareScope>('sitemap');
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('never');
  const [portal, setPortal] = useState<WebsitePortalShareScope>(portalScope);
  const [links, setLinks] = useState(shares);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copyLink = async (token: string, id: string) => {
    await navigator.clipboard.writeText(publicShareUrl(token));
    setCopiedId(id);
    toast.success('Link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const createLink = () => {
    startTransition(async () => {
      try {
        const result = await createWebsiteShare({
          accountId,
          websiteId,
          scope: shareScope,
          expiresAt: expiresAtFromPreset(expiryPreset),
        });
        setLinks((prev) => [
          {
            id: result.id,
            token: result.token,
            scope: result.scope,
            expiresAt: result.expiresAt,
            createdAt: result.createdAt,
          },
          ...prev,
        ]);
        await copyLink(result.token, result.id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create link',
        );
      }
    });
  };

  const revoke = (shareId: string) => {
    startTransition(async () => {
      try {
        await revokeWebsiteShare({ accountId, websiteId, shareId });
        setLinks((prev) => prev.filter((link) => link.id !== shareId));
        toast.success('Link revoked');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not revoke link',
        );
      }
    });
  };

  const updatePortal = (scope: WebsitePortalShareScope) => {
    setPortal(scope);
    startTransition(async () => {
      try {
        await setWebsitePortalScope({ accountId, websiteId, scope });
        toast.success('Portal visibility updated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update portal',
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Client portal
        </p>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Logged-in clients see planning artefacts on their portal Website page.
        </p>
        <Select
          value={portal}
          onValueChange={(value) =>
            updatePortal(value as WebsitePortalShareScope)
          }
          disabled={!canEdit || pending}
        >
          <SelectTrigger className="mt-3 max-w-xs border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PORTAL_SCOPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Public share links
        </p>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Send stakeholders a read-only link — no Ozer login required. Clients
          can approve pages or request changes.
        </p>

        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Select
              value={shareScope}
              onValueChange={(value) =>
                setShareScope(value as WebsiteShareScope)
              }
            >
              <SelectTrigger className="w-56 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_SCOPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={expiryPreset}
              onValueChange={(value) =>
                setExpiryPreset(value as ExpiryPreset)
              }
            >
              <SelectTrigger className="w-48 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_PRESETS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" disabled={pending} onClick={createLink}>
              <Link2 className="mr-2 h-4 w-4" />
              Generate link
            </Button>
          </div>
        ) : null}

        {links.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--workspace-shell-text-muted)]">
                  {SHARE_SCOPES.find((item) => item.value === link.scope)?.label ??
                    link.scope}
                  {' · '}
                  {formatExpiry(link.expiresAt)}
                  {' · '}
                  {new Date(link.createdAt).toLocaleDateString('en-GB')}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copyLink(link.token, link.id)}
                  >
                    {copiedId === link.id ? (
                      <Check className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <Copy className="mr-1 h-3.5 w-3.5" />
                    )}
                    Copy
                  </Button>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => revoke(link.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            No active share links yet.
          </p>
        )}
      </div>
    </div>
  );
}
