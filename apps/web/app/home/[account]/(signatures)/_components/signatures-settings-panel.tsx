'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PlugZap, Save, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
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
    const domain = primaryDomain.trim().toLowerCase();
    const adminEmail = delegatedAdminEmail.trim().toLowerCase();

    if (!domain.includes('.')) {
      toast.error('Enter a valid primary domain (e.g. example.com)');
      return;
    }
    if (!adminEmail.includes('@')) {
      toast.error('Enter a valid delegated admin email');
      return;
    }
    if (!adminEmail.endsWith(`@${domain}`)) {
      toast.error(`Delegated admin email must belong to ${domain}`);
      return;
    }

    setConnectingGoogle(true);
    try {
      const result = await connectGoogleWorkspaceAction({
        accountId,
        primaryDomain: domain,
        delegatedAdminEmail: adminEmail,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
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
    <div className="space-y-6">
        <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CardHeader>
            <CardTitle>Google Workspace connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {googleConnection ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4 text-sm">
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
              <div className="space-y-4 rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] bg-black/10 p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[var(--ozer-accent-subtle)] p-2 text-[var(--ozer-accent)]">
                    <PlugZap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Connect Google Workspace</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      After domain-wide delegation is set up in Google Admin,
                      enter your domain and a super-admin email. Ozer verifies
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

        <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CardHeader>
            <CardTitle>Microsoft 365 connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {msConnection ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4 text-sm">
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
              <div className="space-y-4 rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] bg-black/10 p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[var(--ozer-accent-subtle)] p-2 text-[var(--ozer-accent)]">
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
                  <a href={connectHref}>Connect Microsoft 365</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
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
              <div className="space-y-2 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
                {departmentBadges.map((badge) => (
                  <div
                    key={badge.department}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] py-2 last:border-b-0"
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
  );
}
