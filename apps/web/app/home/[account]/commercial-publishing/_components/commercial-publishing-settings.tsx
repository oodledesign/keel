'use client';

import { useState, useTransition } from 'react';

import { CheckCircle2, Copy, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import type { CommercialListing } from '../../listings/_lib/server/listings.service';
import type { CommercialPublishingSettings } from '../_lib/server/commercial-publishing.loader';
import {
  ensureEachFeedAction,
  ensurePropertyHiveFeedAction,
  rotateEachFeedAction,
  rotatePropertyHiveFeedAction,
  savePropertyHiveCredentialsAction,
  saveRightmoveWorkspaceBranchesAction,
  testPublishListingAction,
} from '../_lib/server/server-actions';

interface CommercialPublishingSettingsProps {
  accountId: string;
  initialSettings: CommercialPublishingSettings;
  listings: CommercialListing[];
  /** Portal publishing is available from Commercial Solo (1 seat). */
  portalPublishingUnlocked?: boolean;
}

function ConfiguredBadge({
  configured,
  feedEnabled,
}: {
  configured: boolean;
  feedEnabled?: boolean;
}) {
  if (configured || feedEnabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
        <CheckCircle2 className="h-3 w-3" />
        {configured && feedEnabled
          ? 'REST + feed'
          : feedEnabled
            ? 'XML feed on'
            : 'Configured'}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/50">
      Not configured
    </span>
  );
}

export function CommercialPublishingSettings({
  accountId,
  initialSettings,
  listings,
  portalPublishingUnlocked = true,
}: CommercialPublishingSettingsProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [phPending, startPhTransition] = useTransition();
  const [rmPending, startRmTransition] = useTransition();
  const [testPending, startTestTransition] = useTransition();
  const [feedPending, startFeedTransition] = useTransition();
  const [eachFeedPending, startEachFeedTransition] = useTransition();
  const [feedUrl, setFeedUrl] = useState(
    initialSettings.propertyHive.feedUrl ?? '',
  );
  const [eachFeedUrl, setEachFeedUrl] = useState(
    initialSettings.each.feedUrl ?? '',
  );

  const [phForm, setPhForm] = useState({
    siteUrl: initialSettings.propertyHive.siteUrl,
    username: initialSettings.propertyHive.username,
    applicationPassword: '',
    officeId: initialSettings.propertyHive.officeId ?? '',
  });

  const [rmBranchIds, setRmBranchIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialSettings.rightmove.workspaceBranches.map((b) => [
        b.id,
        b.rightmoveBranchId ?? '',
      ]),
    ),
  );

  const [testListingId, setTestListingId] = useState<string>('');
  const [testAccountBranchId, setTestAccountBranchId] = useState<string>('');
  const [testPortal, setTestPortal] = useState<
    'property_hive' | 'rightmove' | 'each'
  >('property_hive');

  const savePropertyHive = () => {
    startPhTransition(async () => {
      try {
        const updated = await savePropertyHiveCredentialsAction({
          accountId,
          siteUrl: phForm.siteUrl,
          username: phForm.username,
          applicationPassword: phForm.applicationPassword || undefined,
          officeId: phForm.officeId || null,
        });
        setSettings(updated);
        setPhForm((prev) => ({ ...prev, applicationPassword: '' }));
        toast.success('Property Hive credentials saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  };

  const saveRightmoveBranches = () => {
    startRmTransition(async () => {
      try {
        const updated = await saveRightmoveWorkspaceBranchesAction({
          accountId,
          branches: settings.rightmove.workspaceBranches.map((branch) => ({
            id: branch.id,
            rightmoveBranchId: rmBranchIds[branch.id]?.trim() || null,
          })),
        });
        setSettings(updated);
        setRmBranchIds(
          Object.fromEntries(
            updated.rightmove.workspaceBranches.map((b) => [
              b.id,
              b.rightmoveBranchId ?? '',
            ]),
          ),
        );
        toast.success('Rightmove branch IDs saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  };

  const runTestPublish = () => {
    startTestTransition(async () => {
      try {
        const result = await testPublishListingAction({
          accountId,
          portal: testPortal,
          listingId: testListingId || undefined,
          accountBranchId: testAccountBranchId || undefined,
        });
        if (result.ok) {
          toast.success(result.message);
          if (
            'feedUrl' in result &&
            typeof result.feedUrl === 'string' &&
            result.feedUrl
          ) {
            if (testPortal === 'each') {
              setEachFeedUrl(result.feedUrl);
            } else if (testPortal === 'property_hive') {
              setFeedUrl(result.feedUrl);
            }
          }
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Test failed');
      }
    });
  };

  const enableFeed = () => {
    startFeedTransition(async () => {
      try {
        const result = await ensurePropertyHiveFeedAction({ accountId });
        setSettings(result.settings);
        setFeedUrl(result.feedUrl);
        toast.success(
          result.created
            ? 'Property Hive XML feed enabled'
            : 'Property Hive XML feed ready',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not enable feed',
        );
      }
    });
  };

  const rotateFeed = () => {
    if (
      !confirm(
        'Rotate the Property Hive feed token? Property Hive will stop updating until you paste the new URL.',
      )
    ) {
      return;
    }
    startFeedTransition(async () => {
      try {
        const result = await rotatePropertyHiveFeedAction({ accountId });
        setSettings(result.settings);
        setFeedUrl(result.feedUrl);
        toast.success(
          'Property Hive feed token rotated — update Property Hive with the new URL',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rotate feed',
        );
      }
    });
  };

  const enableEachFeed = () => {
    startEachFeedTransition(async () => {
      try {
        const result = await ensureEachFeedAction({ accountId });
        setSettings(result.settings);
        setEachFeedUrl(result.feedUrl);
        toast.success(
          result.created ? 'EACH XML feed enabled' : 'EACH XML feed ready',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not enable EACH feed',
        );
      }
    });
  };

  const rotateEachFeed = () => {
    if (
      !confirm(
        'Rotate the EACH feed token? EACH will stop updating until you send them the new URL.',
      )
    ) {
      return;
    }
    startEachFeedTransition(async () => {
      try {
        const result = await rotateEachFeedAction({ accountId });
        setSettings(result.settings);
        setEachFeedUrl(result.feedUrl);
        toast.success('EACH feed token rotated — send EACH the new URL');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rotate EACH feed',
        );
      }
    });
  };

  const copyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success('Property Hive feed URL copied');
    } catch {
      toast.error('Could not copy URL');
    }
  };

  const copyEachFeedUrl = async () => {
    if (!eachFeedUrl) return;
    try {
      await navigator.clipboard.writeText(eachFeedUrl);
      toast.success('EACH feed URL copied');
    } catch {
      toast.error('Could not copy URL');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {(settings.recentPublicationIssues?.length ?? 0) > 0 ? (
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Recent portal sync issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {settings.recentPublicationIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="space-y-0.5 py-2.5 first:pt-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    {issue.listingName ?? 'Disposal'}
                    <span className="ml-1 font-normal text-[var(--workspace-shell-text)]/55 capitalize">
                      · {issue.portal.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="text-xs text-rose-500">
                    <span className="capitalize">{issue.status}</span>
                    {issue.lastError ? ` — ${issue.lastError}` : null}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card className={workspacePanelCard}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Property Hive
          </CardTitle>
          <ConfiguredBadge
            configured={settings.propertyHive.configured}
            feedEnabled={settings.propertyHive.feedEnabled}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            Prefer the XML feed below for Property Hive imports. WordPress REST
            credentials are optional for a live API push.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ph-site-url">Site URL</Label>
              <Input
                id="ph-site-url"
                placeholder="https://yoursite.co.uk"
                value={phForm.siteUrl}
                onChange={(e) =>
                  setPhForm((prev) => ({ ...prev, siteUrl: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph-username">Username</Label>
              <Input
                id="ph-username"
                autoComplete="off"
                value={phForm.username}
                onChange={(e) =>
                  setPhForm((prev) => ({ ...prev, username: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph-password">Application password</Label>
              <Input
                id="ph-password"
                type="password"
                autoComplete="new-password"
                placeholder={
                  settings.propertyHive.configured
                    ? 'Leave blank to keep existing'
                    : 'Required'
                }
                value={phForm.applicationPassword}
                onChange={(e) =>
                  setPhForm((prev) => ({
                    ...prev,
                    applicationPassword: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph-office-id">Office ID</Label>
              <Input
                id="ph-office-id"
                placeholder="Optional"
                value={phForm.officeId}
                onChange={(e) =>
                  setPhForm((prev) => ({ ...prev, officeId: e.target.value }))
                }
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={phPending}
            onClick={savePropertyHive}
            className={workspaceBtnPrimaryMd}
          >
            {phPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Property Hive credentials
          </Button>
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Property Hive XML feed
          </CardTitle>
          <ConfiguredBadge configured={settings.propertyHive.feedEnabled} />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            Kato-compatible XML for Property Hive Import. EACH has a separate
            feed URL under Portal publishing so you can later choose different
            stock per portal.
          </p>

          {feedUrl ? (
            <div className="space-y-2">
              <Label>Feed URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={feedUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyFeedUrl}
                  className="shrink-0 gap-1.5"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-[var(--workspace-shell-text)]/55">
                <li>Property Hive → Property Import: Kato XML / generic XML</li>
                <li>Paste this URL, Frequency → Every 15 minutes</li>
                <li>Prefer a real server cron (WP-Cron alone can drift)</li>
              </ol>
            </div>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              Enable the feed to generate a secret URL for Property Hive.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={feedPending}
              onClick={enableFeed}
              className={workspaceBtnPrimaryMd}
            >
              {feedPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {feedUrl ? 'Refresh feed details' : 'Enable XML feed'}
            </Button>
            {feedUrl ? (
              <Button
                type="button"
                variant="outline"
                disabled={feedPending}
                onClick={rotateFeed}
                className="gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Rotate token
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Portal publishing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {!portalPublishingUnlocked ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
              Portal publishing is locked on this subscription. Contact support
              if you expect Rightmove, EACH, or Property Hive to be available.
            </p>
          ) : null}
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            Rightmove Commercial Listings uses platform OAuth (env). Rightmove
            Branch IDs live on each workspace office under Brand settings →
            Branches, and disposals pick an office on Management. EACH and
            Property Hive WordPress use Kato-compatible XML feed URLs (EACH has
            its own token so stock can diverge later).
          </p>

          <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Rightmove
              </h3>
              <ConfiguredBadge
                configured={settings.rightmove.oauthConfigured}
              />
            </div>
            <p className="text-xs text-[var(--workspace-shell-text)]/55">
              OAuth Client ID / Key live in server env (
              {settings.rightmove.environment === 'production'
                ? 'production'
                : 'test'}{' '}
              API).{' '}
              {settings.rightmove.oauthConfigured
                ? 'Platform credentials are present.'
                : 'Set RIGHTMOVE_CLIENT_ID and RIGHTMOVE_CLIENT_KEY, then use Test publish → Rightmove with no listing to verify the token.'}
            </p>
            {settings.rightmove.workspaceBranches.length === 0 ? (
              <p className="text-xs text-amber-200/90">
                No workspace offices yet — add offices under Brand settings →
                Branches, then set each Rightmove Branch ID here.
              </p>
            ) : (
              <div className="space-y-3">
                {settings.rightmove.workspaceBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className="grid gap-2 rounded-lg bg-black/10 px-3 py-3 sm:grid-cols-[1fr_160px] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                        {branch.name}
                      </p>
                      <p className="text-xs text-[var(--workspace-shell-text)]/45">
                        Workspace office from Brand settings
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`rm-id-${branch.id}`}
                        className="text-xs text-[var(--workspace-shell-text)]/55"
                      >
                        Rightmove Branch ID
                      </Label>
                      <Input
                        id={`rm-id-${branch.id}`}
                        inputMode="numeric"
                        value={rmBranchIds[branch.id] ?? ''}
                        disabled={!portalPublishingUnlocked}
                        onChange={(e) =>
                          setRmBranchIds((prev) => ({
                            ...prev,
                            [branch.id]: e.target.value.replace(/\D/g, ''),
                          }))
                        }
                        placeholder="e.g. 283634"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={rmPending || !portalPublishingUnlocked}
                  onClick={saveRightmoveBranches}
                >
                  {rmPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Save Rightmove branch IDs
                </Button>
              </div>
            )}
            {!settings.rightmove.branchConfigured ? (
              <p className="text-xs text-amber-200/90">
                Enter a numeric Rightmove Branch ID for each office that should
                publish disposals.
              </p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                EACH
              </h3>
              <ConfiguredBadge configured={settings.each.configured} />
            </div>
            <p className="text-xs text-[var(--workspace-shell-text)]/55">
              Dedicated Kato-compatible feed URL for EACH. Includes all
              Marketing / Under offer disposals unless switched Off on the
              listing (Overview or Management).
            </p>
            {eachFeedUrl ? (
              <div className="space-y-2">
                <Label>EACH feed URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={eachFeedUrl}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyEachFeedUrl}
                    className="shrink-0 gap-1.5"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-200/90">
                Enable the EACH feed, then send that URL to EACH.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={eachFeedPending}
                onClick={enableEachFeed}
              >
                {eachFeedPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {eachFeedUrl ? 'Refresh EACH feed' : 'Enable EACH feed'}
              </Button>
              {eachFeedUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={eachFeedPending}
                  onClick={rotateEachFeed}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rotate EACH token
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Test publish
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            For Property Hive and EACH, this checks each portal’s XML feed (or
            live REST push for PH if WordPress credentials are saved). For
            Rightmove, leave Listing empty to verify OAuth (optionally pick an
            office to probe its Branch ID); pick a listing to PUT — that listing
            must have an Office / branch assigned on Management.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Portal</Label>
              <Select
                value={testPortal}
                onValueChange={(value) =>
                  setTestPortal(value as typeof testPortal)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={workspaceSelectContentClass}>
                  <SelectItem
                    value="property_hive"
                    className={workspaceSelectItemClass}
                  >
                    Property Hive
                  </SelectItem>
                  <SelectItem
                    value="rightmove"
                    className={workspaceSelectItemClass}
                  >
                    Rightmove
                  </SelectItem>
                  <SelectItem value="each" className={workspaceSelectItemClass}>
                    EACH
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Listing (optional)</Label>
              <Select
                value={testListingId || '__none__'}
                onValueChange={(value) =>
                  setTestListingId(value === '__none__' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No listing — connection only" />
                </SelectTrigger>
                <SelectContent className={workspaceSelectContentClass}>
                  <SelectItem
                    value="__none__"
                    className={workspaceSelectItemClass}
                  >
                    No listing — connection only
                  </SelectItem>
                  {listings.map((listing) => (
                    <SelectItem
                      key={listing.id}
                      value={listing.id}
                      className={workspaceSelectItemClass}
                    >
                      {listing.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {testPortal === 'rightmove' && !testListingId ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Office for branch probe (optional)</Label>
                <Select
                  value={testAccountBranchId || '__none__'}
                  onValueChange={(value) =>
                    setTestAccountBranchId(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="First office with RM ID" />
                  </SelectTrigger>
                  <SelectContent className={workspaceSelectContentClass}>
                    <SelectItem
                      value="__none__"
                      className={workspaceSelectItemClass}
                    >
                      Auto — first office with a Rightmove Branch ID
                    </SelectItem>
                    {settings.rightmove.workspaceBranches.map((branch) => (
                      <SelectItem
                        key={branch.id}
                        value={branch.id}
                        className={workspaceSelectItemClass}
                      >
                        {branch.name}
                        {branch.rightmoveBranchId
                          ? ` · RM ${branch.rightmoveBranchId}`
                          : ' · no RM ID'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={
              testPending ||
              (testPortal === 'rightmove' && !portalPublishingUnlocked)
            }
            onClick={runTestPublish}
          >
            {testPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run test
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
