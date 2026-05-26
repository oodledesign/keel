'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PlugZap } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

export function SignaturesConnectionGate({
  accountId,
  accountSlug,
  connected,
  showUxPreviewBanner,
  children,
}: React.PropsWithChildren<{
  accountId: string;
  /** Workspace route slug (e.g. oodle-1) — required for OAuth return URL. */
  accountSlug: string;
  connected: boolean;
  /** Dev-only: SIGNATURES_UX_PREVIEW without MS 365 — explain banner above content. */
  showUxPreviewBanner?: boolean;
}>) {
  const pathname = usePathname();
  const isSettings = pathname.endsWith('/signatures/settings');

  if (!connected && !isSettings) {
    const href = `/api/signatures/ms-auth?${new URLSearchParams({
      account_id: accountId,
      account_slug: accountSlug,
    }).toString()}`;

    return (
      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-3 rounded-2xl border border-[var(--keel-teal)]/20 bg-[var(--keel-teal)]/10 p-3 text-[var(--keel-teal)]">
            <PlugZap className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Connect Microsoft 365</CardTitle>
        </CardHeader>
        <CardContent className="mx-auto max-w-xl space-y-5 text-center">
          <p className="text-sm text-muted-foreground">
            Signatures needs a Microsoft 365 connection before staff can be
            synced and email signatures can be pushed to Outlook mailboxes.
          </p>
          <Button asChild>
            <Link href={href}>Connect Microsoft 365</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {showUxPreviewBanner ? (
        <div
          className="mb-6 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          <p className="font-semibold text-amber-50">Signatures UX preview</p>
          <p className="mt-1 text-amber-100/90">
            Microsoft 365 is not connected — you can browse screens and empty
            states. Sync, push, and tenant-dependent actions stay unavailable
            until you connect (or turn off{' '}
            <code className="rounded bg-black/20 px-1 font-mono text-xs">
              SIGNATURES_UX_PREVIEW
            </code>{' '}
            to require OAuth again).
          </p>
        </div>
      ) : null}
      {children}
    </>
  );
}
