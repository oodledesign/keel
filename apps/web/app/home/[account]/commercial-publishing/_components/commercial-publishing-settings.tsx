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
  testPublishListingAction,
} from '../_lib/server/server-actions';

interface CommercialPublishingSettingsProps {
  accountId: string;
  initialSettings: CommercialPublishingSettings;
  listings: CommercialListing[];
  /** Rightmove / EG require 2+ billable seats. */
  portalPublishingUnlocked?: boolean;
}

function ConfiguredBadge({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/50">
        Not configured
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
      <CheckCircle2 className="h-3 w-3" />
      Configured
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

  const [rmForm, setRmForm] = useState({
    branchId: initialSettings.rightmove.branchId,
    networkId: initialSettings.rightmove.networkId,
    username: initialSettings.rightmove.username,
    secret: '',
  });

  const [eachForm, setEachForm] = useState({
    branchId: initialSettings.each.branchId,
    networkId: initialSettings.each.networkId,
    username: initialSettings.each.username,
    secret: '',
  });

  const [testListingId, setTestListingId] = useState<string>('');
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

  const saveRightmove = () => {
    startRmTransition(async () => {
      try {
        const updated = await savePortalCredentialsAction({
          accountId,
          portal: 'rightmove',
          branchId: rmForm.branchId,
          networkId: rmForm.networkId,
          username: rmForm.username,
          secret: rmForm.secret || undefined,
        });
        setSettings(updated);
        setRmForm((prev) => ({ ...prev, secret: '' }));
        toast.success('Rightmove credentials saved');
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
        });
        if (result.ok) {
          toast.success(result.message);
        } else {
          toast.message(result.message);
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
          <ConfiguredBadge configured={settings.propertyHive.configured} />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            Connect your WordPress Property Hive site to push disposals to your
            agency website.
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
            Store RTDF / EACH feed credentials. Live Rightmove RTDF requires an
            ADF certificate — these fields save credentials for when the feed is
            wired.
          </p>

          <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Rightmove
              </h3>
              <ConfiguredBadge configured={settings.rightmove.configured} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rm-branch-id">Branch ID</Label>
                <Input
                  id="rm-branch-id"
                  value={rmForm.branchId}
                  onChange={(e) =>
                    setRmForm((prev) => ({
                      ...prev,
                      branchId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm-network-id">Network ID</Label>
                <Input
                  id="rm-network-id"
                  value={rmForm.networkId}
                  onChange={(e) =>
                    setRmForm((prev) => ({
                      ...prev,
                      networkId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm-username">Username</Label>
                <Input
                  id="rm-username"
                  autoComplete="off"
                  value={rmForm.username}
                  onChange={(e) =>
                    setRmForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm-secret">Secret</Label>
                <Input
                  id="rm-secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    settings.rightmove.configured
                      ? 'Leave blank to keep existing'
                      : 'Required'
                  }
                  value={rmForm.secret}
                  onChange={(e) =>
                    setRmForm((prev) => ({ ...prev, secret: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={rmPending || !portalPublishingUnlocked}
              onClick={saveRightmove}
            >
              {rmPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Rightmove credentials
            </Button>
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
            Optionally push a disposal to verify credentials. Property Hive
            performs a live API call; Rightmove and EACH record validation
            status until feeds are connected.
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
                  <SelectValue placeholder="Select a listing" />
                </SelectTrigger>
                <SelectContent className={workspaceSelectContentClass}>
                  <SelectItem
                    value="__none__"
                    className={workspaceSelectItemClass}
                  >
                    None — credentials check only
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
