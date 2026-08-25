'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

type InstagramOauthBannerProps = {
  error: string | null;
  success: boolean;
};

export function InstagramOauthBanner({
  error,
  success,
}: InstagramOauthBannerProps) {
  if (!error && !success) return null;

  return (
    <div
      className={`mx-4 rounded-lg border px-4 py-3 text-sm lg:mx-0 ${
        error
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-emerald-300 bg-emerald-50 text-emerald-900'
      }`}
    >
      {error ? error : 'Instagram account connected successfully.'}
    </div>
  );
}

type InstagramConnectPanelProps = {
  accountId: string;
  accountSlug: string;
  connected: {
    ig_username: string | null;
    token_expires_at: string | null;
    is_active: boolean;
  } | null;
  instagramConfigured: boolean;
  onDisconnect: (input: { accountId: string }) => Promise<{ ok: boolean }>;
};

export function InstagramConnectPanel({
  accountId,
  accountSlug,
  connected,
  instagramConfigured,
  onDisconnect,
}: InstagramConnectPanelProps) {
  const [pending, startTransition] = useTransition();

  const connectHref = `/api/instagram-autoreply/auth/instagram/start?account_id=${accountId}`;

  const expiresLabel = connected?.token_expires_at
    ? new Date(connected.token_expires_at).toLocaleDateString()
    : 'Unknown';

  return (
    <div className="mx-4 space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-6 lg:mx-0">
      {!instagramConfigured ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Instagram OAuth is not configured. Set META_INSTAGRAM_APP_ID (or
          META_APP_ID), META_INSTAGRAM_APP_SECRET (or META_APP_SECRET), and
          META_REDIRECT_URI on the server. Use the Instagram App ID/Secret from
          Meta → Instagram → Business login settings.
        </p>
      ) : null}

      {connected?.is_active ? (
        <>
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              @{connected.ig_username ?? 'connected'}
            </p>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Token expires: {expiresLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={connectHref}>Reconnect</a>
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await onDisconnect({ accountId });
                    toast.success('Instagram disconnected');
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : 'Disconnect failed',
                    );
                  }
                })
              }
            >
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Connect your Instagram Business account to enable comment
            auto-replies for {accountSlug}.
          </p>
          <Button asChild disabled={!instagramConfigured}>
            <a href={connectHref}>Connect Instagram</a>
          </Button>
        </div>
      )}
    </div>
  );
}
