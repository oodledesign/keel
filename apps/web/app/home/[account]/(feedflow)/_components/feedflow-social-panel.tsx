'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Instagram, Music2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type { FeedflowSocialAccountRow } from '../../_lib/server/feedflow-account-data';
import { deleteFeedflowSocialAccount } from '../_lib/server/feedflow-module-actions';

function oauthStartUrl(
  provider: 'instagram' | 'tiktok' | 'google',
  accountId: string,
  returnPath: string,
) {
  const base = `/api/feedflow/auth/${provider}/start`;
  const q = new URLSearchParams({
    account_id: accountId,
    return: returnPath,
  });
  return `${base}?${q.toString()}`;
}

function platformLabel(row: FeedflowSocialAccountRow) {
  const kind = (row.platform ?? row.provider ?? '').toLowerCase();
  if (kind === 'instagram') return 'Instagram';
  if (kind === 'tiktok') return 'TikTok';
  if (kind === 'google') return 'Google';
  return row.platform ?? row.provider ?? 'Account';
}

function formatRefreshedAt(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FeedflowSocialPanel(props: {
  accountSlug: string;
  accountId: string;
  accounts: FeedflowSocialAccountRow[];
  instagramEnabled: boolean;
  tiktokEnabled: boolean;
  googleConfigured: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(
    null,
  );

  const returnPath = pathsConfig.app.accountFeedflowSocialAccounts.replace(
    '[account]',
    props.accountSlug,
  );

  const pendingRow = props.accounts.find((row) => row.id === pendingDisconnectId);

  const disconnect = async (socialAccountId: string) => {
    setDeletingId(socialAccountId);
    try {
      await deleteFeedflowSocialAccount({
        accountId: props.accountId,
        socialAccountId,
      });
      toast.success('Connection removed');
      setPendingDisconnectId(null);
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <div className="flex items-start gap-3">
            <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
              <Instagram className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-medium">Instagram</p>
              <p className="text-muted-foreground text-sm">
                Pull posts into widgets for your site. Business or Creator
                accounts only.
              </p>
            </div>
          </div>
          {props.instagramEnabled ? (
            <Button
              asChild
              className="w-full sm:w-auto"
              data-test="connect-instagram"
            >
              <a href={oauthStartUrl('instagram', props.accountId, returnPath)}>
                Connect Instagram
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Instagram connect isn’t available yet. Check back soon.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <div className="flex items-start gap-3">
            <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
              <Music2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-medium">TikTok</p>
              <p className="text-muted-foreground text-sm">
                Show recent TikToks alongside Instagram in the same widget grid.
              </p>
            </div>
          </div>
          {props.tiktokEnabled ? (
            <Button
              asChild
              variant="secondary"
              className="w-full sm:w-auto"
              data-test="connect-tiktok"
            >
              <a href={oauthStartUrl('tiktok', props.accountId, returnPath)}>
                Connect TikTok
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Coming soon</p>
          )}
        </div>
      </div>

      {props.googleConfigured ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-4 py-3">
          <div>
            <p className="font-medium">Google Business</p>
            <p className="text-muted-foreground text-sm">
              Preview connection for reviews (not required for feed widgets).
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={oauthStartUrl('google', props.accountId, returnPath)}>
              Connect Google
            </a>
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Connected accounts
        </h3>

        {props.accounts.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm">
            No accounts connected yet. Connect Instagram above to start building
            feed widgets.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-muted-foreground border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Platform
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Account
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Last refreshed
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {props.accounts.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {platformLabel(row)}
                    </td>
                    <td className="px-4 py-3">
                      {row.username
                        ? `@${row.username}`
                        : row.external_account_id}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatRefreshedAt(row.last_refreshed_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deletingId === row.id}
                        data-test={`disconnect-${row.id}`}
                        onClick={() => setPendingDisconnectId(row.id)}
                      >
                        {deletingId === row.id ? 'Removing…' : 'Disconnect'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingDisconnectId !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setPendingDisconnectId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRow
                ? `Remove ${platformLabel(pendingRow)}${
                    pendingRow.username ? ` (@${pendingRow.username})` : ''
                  } from this workspace. Widgets using it may stop showing new posts.`
                : 'Widgets using this connection may stop showing new posts.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!pendingDisconnectId || deletingId !== null}
              data-test="disconnect-confirm"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDisconnectId) {
                  void disconnect(pendingDisconnectId);
                }
              }}
            >
              {deletingId ? 'Removing…' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
