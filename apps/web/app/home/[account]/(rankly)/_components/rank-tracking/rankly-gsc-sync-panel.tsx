'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import type { GscKeywordSupplement } from '~/lib/rankly-gsc/types';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

type GscStatusPayload = {
  status: {
    connected: boolean;
    googleEmail: string | null;
    propertyUri: string | null;
    lastSyncAt: string | null;
    lastSyncError: string | null;
    configured: boolean;
  };
  sites: Array<{ siteUrl: string; permissionLevel: string | null }>;
  suggestedProperty: string | null;
  topQueries: GscKeywordSupplement[];
};

function formatSyncAt(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RanklyGscSyncPanel(props: {
  account: string;
  accountId: string;
  projectId: string;
  initialStatus: GscStatusPayload['status'];
  initialSites: GscStatusPayload['sites'];
  initialSuggestedProperty: string | null;
  initialTopQueries: GscKeywordSupplement[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(props.initialStatus);
  const [sites, setSites] = useState(props.initialSites);
  const [suggestedProperty, setSuggestedProperty] = useState(
    props.initialSuggestedProperty,
  );
  const [topQueries, setTopQueries] = useState(props.initialTopQueries);
  const [propertyUri, setPropertyUri] = useState(
    props.initialStatus.propertyUri ??
      props.initialSuggestedProperty ??
      props.initialSites[0]?.siteUrl ??
      '',
  );
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: props.projectId,
        accountId: props.accountId,
      });
      const res = await fetch(`/api/rankly/gsc?${params.toString()}`);
      const json = (await res.json()) as ApiResponse<GscStatusPayload>;
      if (!json.ok) throw new Error(json.error.message);
      setStatus(json.data.status);
      setSites(json.data.sites);
      setSuggestedProperty(json.data.suggestedProperty);
      setTopQueries(json.data.topQueries);
      setPropertyUri(
        json.data.status.propertyUri ??
          json.data.suggestedProperty ??
          json.data.sites[0]?.siteUrl ??
          '',
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('gsc_connected');
    const error = params.get('gsc_error');
    if (connected === '1') {
      toast.success('Google Search Console connected');
      router.replace(window.location.pathname);
      void refreshStatus();
      router.refresh();
    } else if (error) {
      toast.error(error);
      router.replace(window.location.pathname);
    } else if (props.initialStatus.connected && props.initialSites.length === 0) {
      void refreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / oauth return only
  }, []);

  const saveProperty = async () => {
    if (!propertyUri.trim()) {
      toast.error('Choose a Search Console property');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/rankly/gsc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          propertyUri: propertyUri.trim(),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ propertyUri: string }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Search Console property saved');
      await refreshStatus();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/rankly/gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        rowsUpserted: number;
        startDate: string;
        endDate: string;
      }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success(
        `Synced ${json.data.rowsUpserted.toLocaleString()} query rows (${json.data.startDate} → ${json.data.endDate})`,
      );
      await refreshStatus();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: props.projectId,
        accountId: props.accountId,
      });
      const res = await fetch(`/api/rankly/gsc?${params.toString()}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as ApiResponse<{ disconnected: boolean }>;
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Search Console disconnected');
      setStatus({
        connected: false,
        googleEmail: null,
        propertyUri: null,
        lastSyncAt: null,
        lastSyncError: null,
        configured: status.configured,
      });
      setSites([]);
      setTopQueries([]);
      setPropertyUri('');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const connectHref = `/api/rankly/gsc/start?account=${encodeURIComponent(props.account)}&projectId=${encodeURIComponent(props.projectId)}`;

  return (
    <div className="space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Google Search Console
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
            Pull clicks, impressions, and average position for your tracked
            keywords — real Google Search performance alongside SERP ranks.
          </p>
        </div>
        {!status.connected ? (
          <Button asChild disabled={!status.configured || loading}>
            <a href={connectHref}>
              {status.configured ? 'Connect Search Console' : 'Not configured'}
            </a>
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || syncing || !status.propertyUri}
              onClick={syncNow}
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading || syncing}
              onClick={disconnect}
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {!status.configured ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
          GOOGLE_GSC_REDIRECT_URI (or NEXT_PUBLIC_SITE_URL) to enable Search
          Console OAuth.
        </p>
      ) : null}

      {status.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Connected as{' '}
            <span className="text-[var(--workspace-shell-text)]">
              {status.googleEmail ?? 'Google account'}
            </span>
            {' · '}
            Last sync {formatSyncAt(status.lastSyncAt)}
          </p>

          {status.lastSyncError ? (
            <p className="text-sm text-[var(--ozer-accent-pressed,#C2452A)]">
              {status.lastSyncError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="gsc-property">Property</Label>
              <select
                id="gsc-property"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                value={propertyUri}
                onChange={(event) => setPropertyUri(event.target.value)}
              >
                {sites.length === 0 ? (
                  <option value="">No properties available</option>
                ) : (
                  sites.map((site) => (
                    <option key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl}
                      {suggestedProperty === site.siteUrl ? ' (suggested)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={loading || !propertyUri}
              onClick={saveProperty}
            >
              Save property
            </Button>
          </div>

          {topQueries.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-[color:var(--workspace-shell-border)]">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="border-b border-[color:var(--workspace-shell-border)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  <tr>
                    <th className="px-3 py-2">Top queries (28d)</th>
                    <th className="px-3 py-2 text-right">Clicks</th>
                    <th className="px-3 py-2 text-right">Impr.</th>
                    <th className="px-3 py-2 text-right">Avg pos</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((row) => (
                    <tr
                      key={row.queryNormalized}
                      className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                    >
                      <td className="px-3 py-2">{row.queryNormalized}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.clicks.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--workspace-shell-text-muted)]">
                        {row.impressions.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--workspace-shell-text-muted)]">
                        {row.position == null ? '—' : row.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : status.propertyUri ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No query metrics yet. Click Sync now to pull the last 28 days from
              Search Console.
            </p>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Choose the Search Console property that matches this project
              domain, then sync.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
