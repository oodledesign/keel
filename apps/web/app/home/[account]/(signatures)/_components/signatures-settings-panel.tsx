'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ChevronDown, PlugZap, Save, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { toast } from '@kit/ui/sonner';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import {
  connectGoogleWorkspaceAction,
  deleteDepartmentBadgeAction,
  disconnectGoogleWorkspaceAction,
  disconnectMicrosoft365,
  upsertDepartmentBadgeAction,
} from '../_lib/server/signatures-module-actions';
import type {
  GoogleConnection,
  MsConnection,
  SignatureDepartmentBadge,
} from '../_lib/server/signatures-data';

export function SignaturesSettingsPanel({
  accountId,
  accountSlug,
  msConnection,
  googleConnection,
  connected,
  departmentBadges,
  departments,
}: {
  accountId: string;
  accountSlug: string;
  msConnection: MsConnection | null;
  googleConnection: GoogleConnection | null;
  connected: boolean;
  departmentBadges: SignatureDepartmentBadge[];
  departments: string[];
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState(
    googleConnection?.primary_domain ?? '',
  );
  const [delegatedAdminEmail, setDelegatedAdminEmail] = useState(
    googleConnection?.delegated_admin_email ?? '',
  );
  const [selectedDepartment, setSelectedDepartment] = useState(
    departments[0] ?? '',
  );
  const [badgeUrl, setBadgeUrl] = useState('');
  const [savingBadge, setSavingBadge] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (connected) {
      if (googleConnection) {
        toast.success('Google Workspace connected');
      } else if (msConnection) {
        toast.success('Microsoft 365 connected');
      }
    }
  }, [connected, googleConnection, msConnection]);

  useEffect(() => {
    if (!selectedDepartment && departments.length) {
      setSelectedDepartment(departments[0] ?? '');
    }
  }, [departments, selectedDepartment]);

  useEffect(() => {
    const existing = departmentBadges.find(
      (badge) => badge.department === selectedDepartment,
    );
    setBadgeUrl(existing?.award_badge_url ?? '');
  }, [departmentBadges, selectedDepartment]);

  const connectHref = `/api/signatures/ms-auth?${new URLSearchParams({
    account_id: accountId,
    account_slug: accountSlug,
  }).toString()}`;

  const disconnectMs = async () => {
    setDisconnecting(true);
    try {
      await disconnectMicrosoft365({ accountId });
      toast.success('Microsoft 365 disconnected');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDisconnecting(false);
    }
  };

  const connectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      await connectGoogleWorkspaceAction({
        accountId,
        primaryDomain,
        delegatedAdminEmail,
      });
      toast.success('Google Workspace connected');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setConnectingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    try {
      await disconnectGoogleWorkspaceAction({ accountId });
      toast.success('Google Workspace disconnected');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const saveDepartmentBadge = async () => {
    if (!selectedDepartment) {
      toast.error('Select a department first');
      return;
    }

    setSavingBadge(true);
    try {
      await upsertDepartmentBadgeAction({
        accountId,
        department: selectedDepartment,
        award_badge_url: badgeUrl,
      });
      toast.success(`Saved badge for ${selectedDepartment}`);
      setBadgeUrl('');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingBadge(false);
    }
  };

  const deleteDepartmentBadge = async (department: string) => {
    setDeletingDepartment(department);
    try {
      await deleteDepartmentBadgeAction({
        accountId,
        department,
      });
      toast.success(`Removed badge for ${department}`);
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeletingDepartment(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CardHeader>
            <CardTitle>Google Workspace connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {googleConnection ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Primary domain</p>
                    <p className="font-mono text-xs">{googleConnection.primary_domain}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delegated admin</p>
                    <p className="font-mono text-xs">
                      {googleConnection.delegated_admin_email}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Connected</p>
                    <p>{new Date(googleConnection.connected_at).toLocaleString()}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={disconnectGoogle}
                  disabled={disconnectingGoogle}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[var(--keel-teal)]/10 p-2 text-[var(--keel-teal)]">
                    <PlugZap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Connect Google Workspace</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      After domain-wide delegation is set up in Google Admin,
                      enter your domain and a super-admin email. Keel verifies
                      access and syncs staff via the Directory API.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="google-primary-domain">Primary domain</Label>
                    <Input
                      id="google-primary-domain"
                      placeholder="example.com"
                      value={primaryDomain}
                      onChange={(event) => setPrimaryDomain(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-admin-email">Delegated admin email</Label>
                    <Input
                      id="google-admin-email"
                      type="email"
                      placeholder="admin@example.com"
                      value={delegatedAdminEmail}
                      onChange={(event) =>
                        setDelegatedAdminEmail(event.target.value)
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={connectGoogle}
                  disabled={
                    connectingGoogle ||
                    !primaryDomain.trim() ||
                    !delegatedAdminEmail.trim()
                  }
                >
                  {connectingGoogle ? 'Connecting...' : 'Connect Google Workspace'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CardHeader>
            <CardTitle>Microsoft 365 connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {msConnection ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tenant ID</p>
                    <p className="font-mono text-xs">{msConnection.ms_tenant_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Connected</p>
                    <p>{new Date(msConnection.connected_at).toLocaleString()}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={disconnectMs}
                  disabled={disconnecting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[var(--keel-teal)]/10 p-2 text-[var(--keel-teal)]">
                    <PlugZap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">No Microsoft tenant connected</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Connect Microsoft 365 to sync staff and push Outlook
                      signatures.
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href={connectHref}>Connect Microsoft 365</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CardHeader>
            <CardTitle>Department badges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departments.length ? (
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Badge image URL</Label>
                  <Input
                    type="url"
                    placeholder="https://cdn.example.com/awards/costar.png"
                    value={badgeUrl}
                    onChange={(event) => setBadgeUrl(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={saveDepartmentBadge}
                    disabled={savingBadge || !selectedDepartment}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingBadge ? 'Saving...' : 'Save badge'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sync staff first to discover departments.
              </p>
            )}

            {departmentBadges.length ? (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/10 p-4">
                {departmentBadges.map((badge) => (
                  <div
                    key={badge.department}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{badge.department}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {badge.award_badge_url}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => deleteDepartmentBadge(badge.department)}
                      disabled={deletingDepartment === badge.department}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingDepartment === badge.department
                        ? 'Removing...'
                        : 'Remove'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle>Google Workspace setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Setup instructions
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">
              <p>
                Enable Admin SDK and Gmail APIs in Google Cloud, create a service
                account, and authorize domain-wide delegation in Google Admin
                with Directory + Gmail settings scopes.
              </p>
              <p>
                Set GOOGLE_SERVICE_ACCOUNT_JSON (or EMAIL + PRIVATE_KEY) in the
                web app environment.
              </p>
              <p>
                See SIGNATURES_GOOGLE_SETUP.md in the repo for the full checklist.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle>Azure setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Setup instructions
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">
              <p>
                Create an Azure App Registration and add a web redirect URI for
                <code className="mx-1 text-xs">/api/signatures/ms-callback</code>.
              </p>
              <p>
                Configure delegated scopes: MailboxSettings.ReadWrite,
                User.Read.All, ProfilePhoto.Read.All, and offline_access.
              </p>
              <p>
                Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_REDIRECT_URI
                in the web app environment.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
