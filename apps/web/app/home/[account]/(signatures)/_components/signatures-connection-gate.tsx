'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PlugZap } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import type { SignaturesMailProvider } from '../_lib/server/signatures-data';

export function SignaturesConnectionGate({
  accountId,
  accountSlug,
  connected,
  mailProvider,
  showUxPreviewBanner,
  children,
}: React.PropsWithChildren<{
  accountId: string;
  accountSlug: string;
  connected: boolean;
  mailProvider?: SignaturesMailProvider;
  showUxPreviewBanner?: boolean;
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isSettings = pathname.endsWith('/signatures/settings');

  const settingsPath = pathsConfig.app.accountSignaturesSettings.replace(
    '[account]',
    accountSlug,
  );

  if (!connected && !isSettings) {
    const msHref = `/api/signatures/ms-auth?${new URLSearchParams({
      account_id: accountId,
      account_slug: accountSlug,
    }).toString()}`;

    return (
      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-3 rounded-2xl border border-[var(--keel-teal)]/20 bg-[var(--keel-teal)]/10 p-3 text-[var(--keel-teal)]">
            <PlugZap className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Connect your mail provider</CardTitle>
        </CardHeader>
        <CardContent className="mx-auto max-w-xl space-y-5 text-center">
          <p className="text-sm text-muted-foreground">
            Sync staff from your directory and push HTML signatures to Outlook
            or Gmail. Choose Microsoft 365 or Google Workspace below.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <a href={msHref}>Connect Microsoft 365</a>
            </Button>
            <Button asChild variant="outline">
              <Link href={settingsPath}>Connect Google Workspace</Link>
            </Button>
          </div>
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
            No mail provider is connected — you can browse screens and empty
            states. Sync, push, and directory actions stay unavailable until you
            connect (or turn off{' '}
            <code className="rounded bg-black/20 px-1 font-mono text-xs">
              SIGNATURES_UX_PREVIEW
            </code>
            ).
          </p>
        </div>
      ) : null}
      {connected && mailProvider ? (
        <p className="text-xs text-muted-foreground">
          Connected via{' '}
          {mailProvider === 'google' ? 'Google Workspace' : 'Microsoft 365'}.
        </p>
      ) : null}
      {children}
    </>
  );
}
