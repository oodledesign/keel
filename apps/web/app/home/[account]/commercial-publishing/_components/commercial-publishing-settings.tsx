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
  ensurePropertyHiveFeedAction,
  rotatePropertyHiveFeedAction,
  savePortalCredentialsAction,
  savePropertyHiveCredentialsAction,
  saveRightmoveWorkspaceBranchesAction,
  testPublishListingAction,
} from '../_lib/server/server-actions';

interface CommercialPublishingSettingsProps {
  accountId: string;
  initialSettings: CommercialPublishingSettings;
  listings: CommercialListing[];
  /** Rightmove / EG require 2+ billable seats. */
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
  const [eachPending, startEachTransition] = useTransition();
  const [testPending, startTestTransition] = useTransition();
  const [feedPending, startFeedTransition] = useTransition();
  const [feedUrl, setFeedUrl] = useState(
    initialSettings.propertyHive.feedUrl ?? '',
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

  const [eachForm, setEachForm] = useState({
    branchId: initialSettings.each.branchId,
    networkId: initialSettings.each.networkId,
    username: initialSettings.each.username,
    secret: '',
  });

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

  const saveEach = () => {
    startEachTransition(async () => {
      try {
        const updated = await savePortalCredentialsAction({
          accountId,
          portal: 'each',
          branchId: eachForm.branchId,
          networkId: eachForm.networkId,
          username: eachForm.username,
          secret: eachForm.secret || undefined,
        });
        setSettings(updated);
        setEachForm((prev) => ({ ...prev, secret: '' }));
        toast.success('EACH credentials saved');
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
            setFeedUrl(result.feedUrl);
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
        'Rotate the feed token? Property Hive will stop updating until you paste the new URL.',
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
          'Feed token rotated — update Property Hive with the new URL',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rotate feed',
        );
      }
    });
  };

  const copyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success('Feed URL copied');
    } catch {
      toast.error('Could not copy URL');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
            Kato-compatible XML that Property Hive can pull every 15 minutes.
            Includes marketing / under-offer disposals, units, images and
            documents. Prefer this over push if you already run PH Import.
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
                <li>
                  In Property Hive → Property Import, create/edit an import
                </li>
                <li>
                  Format: <strong>Kato XML</strong> or{' '}
                  <strong>generic XML</strong>
                </li>
                <li>Paste this URL, Frequency → Every 15 minutes</li>
                <li>
                  For reliable timing, add a real server cron (WP-Cron alone can
                  drift)
                </li>
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
              Portal publishing (Rightmove / EACH) unlocks from 2 billable
              seats. Property Hive website sync remains available on Solo.
            </p>
          ) : null}
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            Rightmove Commercial Listings uses platform OAuth (env). Rightmove
            Branch IDs live on each workspace office under Brand settings →
            Branches, and disposals pick an office on Management. EACH still
            uses per-workspace feed credentials.
          </p>

          <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Rightmove
              </h3>
              <ConfiguredBadge configured={settings.rightmove.oauthConfigured} />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="each-branch-id">Branch ID</Label>
                <Input
                  id="each-branch-id"
                  value={eachForm.branchId}
                  onChange={(e) =>
                    setEachForm((prev) => ({
                      ...prev,
                      branchId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="each-network-id">Network ID</Label>
                <Input
                  id="each-network-id"
                  value={eachForm.networkId}
                  onChange={(e) =>
                    setEachForm((prev) => ({
                      ...prev,
                      networkId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="each-username">Username</Label>
                <Input
                  id="each-username"
                  autoComplete="off"
                  value={eachForm.username}
                  onChange={(e) =>
                    setEachForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="each-secret">Secret</Label>
                <Input
                  id="each-secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    settings.each.configured
                      ? 'Leave blank to keep existing'
                      : 'Required'
                  }
                  value={eachForm.secret}
                  onChange={(e) =>
                    setEachForm((prev) => ({ ...prev, secret: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={eachPending || !portalPublishingUnlocked}
              onClick={saveEach}
            >
              {eachPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save EACH credentials
            </Button>
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
            For Property Hive, this checks your XML feed (or live REST push if
            WordPress credentials are saved). For Rightmove, leave Listing empty
            to verify OAuth (optionally pick an office to probe its Branch ID);
            pick a listing to PUT — that listing must have an Office / branch
            assigned on Management. EACH still records validation until its feed
            is connected.
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
              (testPortal !== 'property_hive' && !portalPublishingUnlocked)
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
