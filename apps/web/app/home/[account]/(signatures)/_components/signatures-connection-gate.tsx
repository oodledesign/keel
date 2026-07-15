'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PlugZap } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

export function SignaturesConnectionGate({
  accountId,
  accountSlug,
  connected,
  showUxPreviewBanner,
  children,
}: React.PropsWithChildren<{
  accountId: string;
  accountSlug: string;
  connected: boolean;
  showUxPreviewBanner?: boolean;
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isIntegrationsArea =
    pathname.includes('/signatures/settings') ||
    pathname.includes('/signatures/integrations') ||
    pathname.includes('/signatures/custom-data');

  const integrationsPath =
    pathsConfig.app.accountSignaturesIntegrations.replace(
      '[account]',
      accountSlug,
    );

  if (!connected && !isIntegrationsArea) {
    const msHref = `/api/signatures/ms-auth?${new URLSearchParams({
      account_id: accountId,
      account_slug: accountSlug,
    }).toString()}`;

    return (
      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-[0_1px_2px_rgba(42,23,32,0.05),0_4px_14px_rgba(42,23,32,0.05)]">
        <CardHeader className="items-center text-center">
          <div className="mb-3 rounded-2xl border border-[var(--ozer-accent)]/20 bg-[var(--ozer-accent-subtle)] p-3 text-[var(--ozer-accent)]">
            <PlugZap className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Connect your mail provider</CardTitle>
        </CardHeader>
        <CardContent className="mx-auto max-w-xl space-y-5 text-center">
          <p className="text-muted-foreground text-sm">
            Sync staff from your directory to design and share HTML signatures
            for Outlook or Gmail. Connect Microsoft 365 or Google Workspace
            below.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <a href={msHref}>Connect Microsoft 365</a>
            </Button>
            <Button asChild variant="outline">
              <Link href={integrationsPath}>Connect Google Workspace</Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Not the Microsoft or Google admin?{' '}
            <Link
              href={integrationsPath}
              className="font-medium text-[var(--ozer-accent)] underline-offset-4 hover:underline"
            >
              Send them an invite link from Integrations
            </Link>
          </p>
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
            <code className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-1 font-mono text-xs">
              SIGNATURES_UX_PREVIEW
            </code>
            ).
          </p>
        </div>
      ) : null}
      {children}
    </>
  );
}
