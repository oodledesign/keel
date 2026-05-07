'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

  const returnPath = pathsConfig.app.accountFeedflowSocialAccounts.replace(
    '[account]',
    props.accountSlug,
  );

  const disconnect = async (socialAccountId: string) => {
    if (!globalThis.confirm('Remove this connection? Widgets using it may stop working.')) {
      return;
    }
    setDeletingId(socialAccountId);
    try {
      await deleteFeedflowSocialAccount({
        accountId: props.accountId,
        socialAccountId,
      });
      toast.success('Connection removed');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {props.instagramEnabled ? (
          <Button asChild variant="default" size="sm">
            <Link
              href={oauthStartUrl('instagram', props.accountId, returnPath)}
            >
              Connect Instagram
            </Link>
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Instagram: set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI
            (callback must be{' '}
            <code className="text-xs">
              …/api/feedflow/auth/instagram/callback
            </code>
            ).
          </p>
        )}
        {props.tiktokEnabled ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={oauthStartUrl('tiktok', props.accountId, returnPath)}>
              Connect TikTok
            </Link>
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            TikTok: set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI.
          </p>
        )}
        {props.googleConfigured ? (
          <Button asChild variant="outline" size="sm">
            <Link href={oauthStartUrl('google', props.accountId, returnPath)}>
              Google Business (preview)
            </Link>
          </Button>
        ) : null}
      </div>

      {props.accounts.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No connections yet. Use Connect above (after env is configured).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">External id</th>
                <th className="px-4 py-3">Last refresh</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {props.accounts.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3">{row.platform ?? '—'}</td>
                  <td className="px-4 py-3">{row.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.external_account_id}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.last_refreshed_at
                      ? new Date(row.last_refreshed_at).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deletingId === row.id}
                      onClick={() => disconnect(row.id)}
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
  );
}
