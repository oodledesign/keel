'use client';

import { useEffect, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Info, Link2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  disconnectFreeAgentAction,
  loadFinancesSettingsAction,
  syncFreeAgentAction,
} from '~/home/[account]/finances/_lib/server/finances-actions';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

type SettingsData = Awaited<ReturnType<typeof loadFinancesSettingsAction>>;

export function FinancesSettingsPanel({
  accountId,
  accountSlug,
  initialData,
}: {
  accountId: string;
  accountSlug: string;
  initialData: SettingsData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const data = initialData;

  useEffect(() => {
    if (searchParams.get('finance_connected') === '1') {
      toast.success('FreeAgent connected');
      startTransition(async () => {
        try {
          await syncFreeAgentAction({ accountId, accountSlug });
          toast.success(
            'FreeAgent synced — transactions and categories imported',
          );
          router.replace(
            pathsConfig.app.accountFinancesSettings.replace(
              '[account]',
              accountSlug,
            ),
          );
          router.refresh();
        } catch {
          toast.error('Connected, but initial sync failed — try Sync now');
          router.replace(
            pathsConfig.app.accountFinancesSettings.replace(
              '[account]',
              accountSlug,
            ),
          );
        }
      });
    }

    const err = searchParams.get('finance_error');
    if (err) {
      toast.error(decodeURIComponent(err));
      router.replace(
        pathsConfig.app.accountFinancesSettings.replace(
          '[account]',
          accountSlug,
        ),
      );
    }
  }, [accountId, accountSlug, router, searchParams]);

  const connected = Boolean(data.connection);
  const connectUrl = `/api/integrations/freeagent/start?account=${encodeURIComponent(accountSlug)}&returnTo=settings`;
  const financesPath = pathsConfig.app.accountFinances.replace(
    '[account]',
    accountSlug,
  );

  const onSync = () => {
    startTransition(async () => {
      try {
        const result = await syncFreeAgentAction({ accountId, accountSlug });
        router.refresh();
        const parts = [
          `${result.imported} new transaction${result.imported === 1 ? '' : 's'}`,
        ];
        if (result.categoriesSynced > 0) {
          parts.push(
            `${result.categoriesSynced} categor${result.categoriesSynced === 1 ? 'y' : 'ies'} from FreeAgent`,
          );
        }
        toast.success(`Synced ${parts.join(', ')}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Sync failed');
      }
    });
  };

  const onDisconnect = () => {
    startTransition(async () => {
      try {
        await disconnectFreeAgentAction({ accountId, accountSlug });
        router.refresh();
        toast.success('FreeAgent disconnected');
      } catch {
        toast.error('Could not disconnect FreeAgent');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          Finances
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Connect accounting integrations and manage how transactions sync into
          Ozer.{' '}
          <Link
            href={financesPath}
            className="text-[var(--ozer-accent-muted)] underline-offset-2 hover:underline"
          >
            Open finances dashboard
          </Link>
        </p>
      </div>

      <div className={cn(panelClass, 'p-4')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-medium text-[var(--workspace-shell-text)]">
                FreeAgent
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                    aria-label="FreeAgent info"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="max-w-xs text-sm leading-relaxed"
                >
                  {connected
                    ? 'Ozer is your UI; FreeAgent stays the ledger. Categories sync from FreeAgent on each sync. When you categorise in Ozer, Ozer writes a bank transaction explanation in FreeAgent. New transactions sync automatically each morning.'
                    : 'Connect FreeAgent to import bank transactions and categories. Categorise in Ozer and sync explanations back to FreeAgent.'}
                </PopoverContent>
              </Popover>
            </div>
            {connected && data.connection ? (
              <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
                Connected to{' '}
                {data.connection.freeagent_company_name ?? 'FreeAgent'}
              </p>
            ) : null}
            {connected && data.connection?.last_sync_at ? (
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                Last synced{' '}
                {new Date(data.connection.last_sync_at).toLocaleString('en-GB')}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {connected ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[color:var(--workspace-shell-border)]"
                  disabled={pending}
                  onClick={onSync}
                >
                  <RefreshCw
                    className={cn('mr-2 h-4 w-4', pending && 'animate-spin')}
                  />
                  Sync now
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[var(--workspace-shell-text-muted)]"
                  disabled={pending}
                  onClick={onDisconnect}
                >
                  Disconnect
                </Button>
              </>
            ) : data.freeAgentConfigured ? (
              <Button
                type="button"
                asChild
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)]"
              >
                <a href={connectUrl}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect FreeAgent
                </a>
              </Button>
            ) : (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Set FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET to enable.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
