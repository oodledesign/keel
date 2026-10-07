'use client';

import { useEffect, useState, useTransition } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  REVIEW_KEY_LABELS,
  REVIEW_MAPPABLE_KEYS,
  type ReviewMappableKey,
  type WebflowFieldInfo,
  isFieldCompatible,
} from '~/lib/feedflow/webflow/mapping';
import { workspaceBorder, workspaceTextMuted } from '~/lib/workspace-ui';

import type {
  FeedflowWebflowConnectionRow,
  FeedflowWebflowSyncLogRow,
} from '../../_lib/server/feedflow-account-data';
import {
  connectWebflow,
  disconnectWebflow,
  loadWebflowFields,
  loadWebflowTargets,
  saveWebflowSettings,
  saveWebflowTarget,
  syncWebflowNow,
} from '../_lib/server/feedflow-webflow-actions';

type Option = { id: string; displayName: string };

const selectClass =
  'border-input bg-background h-9 w-full rounded-md border px-2 text-sm';

export function FeedflowWebflowPanel(props: {
  accountId: string;
  clientId: string | null;
  connection: FeedflowWebflowConnectionRow | null;
  log: FeedflowWebflowSyncLogRow[];
  oauthAvailable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const connection = props.connection;

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error));
        router.refresh();
      }
    });

  const [token, setToken] = useState('');
  const [showTokenForm, setShowTokenForm] = useState(!props.oauthAvailable);

  const oauthStartHref = (() => {
    const params = new URLSearchParams({
      account_id: props.accountId,
      return: pathname,
    });
    if (props.clientId) params.set('client_id', props.clientId);
    return `/api/feedflow/auth/webflow/start?${params.toString()}`;
  })();

  const [sites, setSites] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [siteId, setSiteId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [changingTarget, setChangingTarget] = useState(false);

  const [fields, setFields] = useState<WebflowFieldInfo[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>(
    connection?.field_mapping ?? {},
  );
  const [syncMode, setSyncMode] = useState(connection?.sync_mode ?? 'all');
  const [autoPublish, setAutoPublish] = useState(
    connection?.auto_publish ?? false,
  );
  const [minRating, setMinRating] = useState(connection?.min_rating ?? 1);
  const [minChars, setMinChars] = useState(
    connection?.min_character_count ?? 0,
  );

  const hasTarget = Boolean(connection?.webflow_collection_id);
  const picking = Boolean(connection) && (!hasTarget || changingTarget);

  // Sites for the picker.
  useEffect(() => {
    if (!connection || !picking) return;
    let cancelled = false;
    loadWebflowTargets({
      accountId: props.accountId,
      connectionId: connection.id,
    })
      .then((result) => {
        if (!cancelled) setSites(result.sites);
      })
      .catch((error) => toast.error(getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [connection, picking, props.accountId]);

  // Fields for the mapping table.
  useEffect(() => {
    if (!connection || !hasTarget) return;
    let cancelled = false;
    loadWebflowFields({
      accountId: props.accountId,
      connectionId: connection.id,
    })
      .then((result) => {
        if (!cancelled) setFields(result.fields);
      })
      .catch((error) => toast.error(getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [connection, hasTarget, props.accountId]);

  if (!connection) {
    return (
      <div className="max-w-lg space-y-3">
        {props.oauthAvailable ? (
          <div
            className={`space-y-3 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
          >
            <p className={`text-sm ${workspaceTextMuted}`}>
              Sign in to Webflow and choose which sites Ozer can update. You
              can disconnect at any time.
            </p>
            <Button asChild>
              <a href={oauthStartHref}>Connect with Webflow</a>
            </Button>
            {!showTokenForm ? (
              <button
                type="button"
                className={`block text-xs underline underline-offset-4 ${workspaceTextMuted}`}
                onClick={() => setShowTokenForm(true)}
              >
                Use an API token instead
              </button>
            ) : null}
          </div>
        ) : null}
        {showTokenForm ? (
      <form
        className={`space-y-3 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            await connectWebflow({
              accountId: props.accountId,
              clientId: props.clientId,
              token,
            });
            setToken('');
            toast.success('Webflow connected');
          });
        }}
      >
        <p className={`text-sm ${workspaceTextMuted}`}>
          Create a site token in Webflow (Site settings → Apps &amp;
          integrations → API access) with CMS read and write access, then paste
          it here. It is stored encrypted and never shown again.
        </p>
        <div className="space-y-1">
          <Label htmlFor="webflow-token">Webflow site API token</Label>
          <Input
            id="webflow-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending || token.trim().length < 10}>
          {pending ? 'Connecting…' : 'Connect Webflow'}
        </Button>
      </form>
        ) : null}
      </div>
    );
  }

  const unmappedRequired = fields.filter(
    (field) =>
      field.isRequired &&
      field.slug !== 'name' &&
      field.slug !== 'slug' &&
      !Object.values(mapping).includes(field.slug),
  );

  return (
    <div className="space-y-6">
      <div
        className={`space-y-3 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {hasTarget
                ? `${connection.site_name ?? 'Site'} → ${connection.collection_name ?? 'Collection'}`
                : 'Choose where reviews go'}
            </p>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Status: {connection.sync_status ?? 'idle'}
              {connection.last_synced_at
                ? ` · last synced ${new Date(connection.last_synced_at).toLocaleString('en-GB')}`
                : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {props.oauthAvailable ? (
              <Button size="sm" variant="outline" asChild>
                <a href={oauthStartHref}>Reconnect</a>
              </Button>
            ) : null}
            {hasTarget ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setChangingTarget((value) => !value)}
              >
                {changingTarget ? 'Cancel' : 'Change collection'}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Disconnect Webflow? Items already in your CMS are left as they are.',
                  )
                ) {
                  return;
                }
                run(async () => {
                  await disconnectWebflow({
                    accountId: props.accountId,
                    connectionId: connection.id,
                  });
                  toast.success('Webflow disconnected');
                });
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>

        {connection.sync_error ? (
          <p className="text-destructive text-sm">{connection.sync_error}</p>
        ) : null}

        {picking ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Site</Label>
              <select
                className={selectClass}
                value={siteId}
                onChange={(event) => {
                  const next = event.target.value;
                  setSiteId(next);
                  setCollectionId('');
                  setCollections([]);
                  if (!next) return;
                  loadWebflowTargets({
                    accountId: props.accountId,
                    connectionId: connection.id,
                    siteId: next,
                  })
                    .then((result) => setCollections(result.collections))
                    .catch((error) => toast.error(getErrorMessage(error)));
                }}
              >
                <option value="">Choose a site…</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reviews collection</Label>
              <select
                className={selectClass}
                value={collectionId}
                disabled={!siteId}
                onChange={(event) => setCollectionId(event.target.value)}
              >
                <option value="">Choose a collection…</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button
                disabled={pending || !siteId || !collectionId}
                onClick={() =>
                  run(async () => {
                    const result = await saveWebflowTarget({
                      accountId: props.accountId,
                      connectionId: connection.id,
                      siteId,
                      collectionId,
                    });
                    setFields(result.fields);
                    setMapping(result.mapping as Record<string, string>);
                    setChangingTarget(false);
                    toast.success(
                      'Collection saved. Check the field mapping below.',
                    );
                  })
                }
              >
                Use this collection
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {hasTarget && !picking ? (
        <div
          className={`space-y-5 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
        >
          <div>
            <p className="text-sm font-medium">Field mapping</p>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Webflow&apos;s Name and Slug are filled automatically (reviewer
              and rating, plus a unique slug).
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {REVIEW_MAPPABLE_KEYS.map((key: ReviewMappableKey) => (
              <div key={key} className="space-y-1">
                <Label>{REVIEW_KEY_LABELS[key]}</Label>
                <select
                  className={selectClass}
                  value={mapping[key] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => {
                      const next = { ...current };
                      if (event.target.value) next[key] = event.target.value;
                      else delete next[key];
                      return next;
                    })
                  }
                >
                  <option value="">Don&apos;t send</option>
                  {fields
                    .filter(
                      (field) =>
                        field.slug !== 'name' &&
                        field.slug !== 'slug' &&
                        isFieldCompatible(key, field.type),
                    )
                    .map((field) => (
                      <option key={field.slug} value={field.slug}>
                        {field.displayName} ({field.type})
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
          {unmappedRequired.length > 0 ? (
            <p className="text-destructive text-sm">
              Required Webflow fields not mapped:{' '}
              {unmappedRequired.map((field) => field.displayName).join(', ')}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Which reviews</Label>
              <select
                className={selectClass}
                value={syncMode}
                onChange={(event) => setSyncMode(event.target.value)}
              >
                <option value="all">All visible reviews</option>
                <option value="with_text">Only reviews with text</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Minimum stars</Label>
              <select
                className={selectClass}
                value={minRating}
                onChange={(event) => setMinRating(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((stars) => (
                  <option key={stars} value={stars}>
                    {stars}+ stars
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="webflow-min-chars">Minimum characters</Label>
              <Input
                id="webflow-min-chars"
                type="number"
                min={0}
                max={5000}
                value={minChars}
                onChange={(event) =>
                  setMinChars(Math.max(0, Number(event.target.value) || 0))
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
            Publish items automatically (otherwise they stay staged in
            Webflow)
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending || unmappedRequired.length > 0}
              onClick={() =>
                run(async () => {
                  await saveWebflowSettings({
                    accountId: props.accountId,
                    connectionId: connection.id,
                    mapping,
                    syncMode: syncMode === 'with_text' ? 'with_text' : 'all',
                    autoPublish,
                    minRating,
                    minCharacterCount: minChars,
                  });
                  toast.success('Settings saved');
                })
              }
            >
              Save settings
            </Button>
            <Button
              disabled={
                pending ||
                connection.sync_status === 'syncing' ||
                unmappedRequired.length > 0
              }
              onClick={() =>
                run(async () => {
                  await saveWebflowSettings({
                    accountId: props.accountId,
                    connectionId: connection.id,
                    mapping,
                    syncMode: syncMode === 'with_text' ? 'with_text' : 'all',
                    autoPublish,
                    minRating,
                    minCharacterCount: minChars,
                  });
                  const result = await syncWebflowNow({
                    accountId: props.accountId,
                    connectionId: connection.id,
                  });
                  toast.success(
                    `Synced: ${result.created} added, ${result.updated} updated, ${result.removed} removed` +
                      (result.partial
                        ? '. More changes remain; sync again to continue.'
                        : ''),
                  );
                })
              }
            >
              {pending ? 'Working…' : 'Save & sync now'}
            </Button>
          </div>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Reviews also sync automatically every few hours.
          </p>
        </div>
      ) : null}

      {props.log.length > 0 ? (
        <div className={`rounded-lg border ${workspaceBorder}`}>
          <p className="px-4 pt-3 text-sm font-medium">Recent syncs</p>
          <ul className="divide-y divide-[color:var(--workspace-shell-border)] text-sm">
            {props.log.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap justify-between gap-2 px-4 py-2"
              >
                <span>
                  {new Date(entry.synced_at).toLocaleString('en-GB')}
                </span>
                <span
                  className={
                    entry.success ? workspaceTextMuted : 'text-destructive'
                  }
                >
                  {entry.success
                    ? `${entry.reviews_synced ?? 0} changed, ${entry.reviews_skipped ?? 0} skipped`
                    : (entry.error_message ?? 'Failed')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
