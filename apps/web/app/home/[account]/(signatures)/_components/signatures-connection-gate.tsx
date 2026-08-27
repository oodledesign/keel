'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { PlugZap, UserRoundPlus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { enableSignaturesManualMode } from '../_lib/server/signatures-module-actions';

export function SignaturesConnectionGate({
  accountId,
  accountSlug,
  connected,
  manualMode,
  showUxPreviewBanner,
  children,
}: React.PropsWithChildren<{
  accountId: string;
  accountSlug: string;
  connected: boolean;
  /** Unlocked via manual mode without a mail provider. */
  manualMode?: boolean;
  showUxPreviewBanner?: boolean;
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [enablingManual, setEnablingManual] = useState(false);
  const isIntegrationsArea =
    pathname.includes('/signatures/settings') ||
    pathname.includes('/signatures/integrations') ||
    pathname.includes('/signatures/custom-data');

  const integrationsPath =
    pathsConfig.app.accountSignaturesIntegrations.replace(
      '[account]',
      accountSlug,
    );

  const enableManual = async () => {
    setEnablingManual(true);
    try {
      await enableSignaturesManualMode({ accountId });
      toast.success('Manual mode enabled — add people and share install links');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setEnablingManual(false);
    }
  };

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
          <CardTitle className="text-2xl">Get started with Signatures</CardTitle>
        </CardHeader>
        <CardContent className="mx-auto max-w-xl space-y-5 text-center">
          <p className="text-muted-foreground text-sm">
            Sync staff from your directory, or add people manually and share
            install links for Outlook or Gmail. Connect a provider later if you
            want Sync and Push.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <a href={msHref}>Connect Microsoft 365</a>
            </Button>
            <Button asChild variant="outline">
              <Link href={integrationsPath}>Connect Google Workspace</Link>
            </Button>
          </div>
          <div className="relative py-1">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden
            >
              <div className="w-full border-t border-[color:var(--workspace-shell-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-[var(--workspace-shell-panel)] px-2 text-[var(--workspace-shell-text-muted)]">
                or
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={enablingManual}
              onClick={() => void enableManual()}
            >
              <UserRoundPlus className="mr-2 h-4 w-4" aria-hidden />
              {enablingManual
                ? 'Enabling…'
                : 'Continue without connecting'}
            </Button>
            <p className="text-muted-foreground text-xs">
              Add people by hand or CSV, design templates, and share HTML
              install links. Each person pastes the signature into their mail
              client.
            </p>
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
      {manualMode ? (
        <div
          className="mb-6 rounded-xl border border-[var(--ozer-accent)]/20 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]"
          role="status"
        >
          <p className="font-semibold">Manual mode</p>
          <p className="mt-1 text-[var(--workspace-shell-text-muted)]">
            Add people and share install links without connecting mail. Sync and
            Push unlock when you{' '}
            <Link
              href={integrationsPath}
              className="font-medium text-[var(--ozer-accent)] underline-offset-4 hover:underline"
            >
              connect Microsoft 365 or Google Workspace
            </Link>
            .
          </p>
        </div>
      ) : null}
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
