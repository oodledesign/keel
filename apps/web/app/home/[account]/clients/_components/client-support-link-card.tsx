'use client';

import { useEffect, useState, useTransition } from 'react';

import { Copy, Link2, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  getClientSupportLinkAction,
  rotateClientSupportLinkAction,
} from '../_lib/server/client-support-link-actions';

export function ClientSupportLinkCard({
  clientOrgId,
  accountSlug,
}: {
  clientOrgId: string;
  accountSlug: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getClientSupportLinkAction({
          clientOrgId,
          accountSlug,
        });
        setUrl(result.url);
      } catch {
        setUrl(null);
      }
    });
  }, [accountSlug, clientOrgId]);

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    toast.success('Support link copied');
  }

  function rotate() {
    startTransition(async () => {
      try {
        const result = await rotateClientSupportLinkAction({
          clientOrgId,
          accountSlug,
        });
        setUrl(result.url);
        toast.success('Support link rotated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rotate link',
        );
      }
    });
  }

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
          <Link2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Public support link
          </h3>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Share with contacts so they can submit tickets without logging in.
          </p>
          <p className="mt-2 truncate font-mono text-xs text-[var(--workspace-shell-text)]">
            {pending && !url ? 'Loading…' : (url ?? 'Unavailable')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!url || pending}
              onClick={copy}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={rotate}
            >
              {pending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Rotate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
