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
  deleteDepartmentBadgeAction,
  disconnectMicrosoft365,
  upsertDepartmentBadgeAction,
} from '../_lib/server/signatures-module-actions';
import type {
  MsConnection,
  SignatureDepartmentBadge,
} from '../_lib/server/signatures-data';

export function SignaturesSettingsPanel({
  accountId,
  accountSlug,
  connection,
  connected,
  departmentBadges,
  departments,
}: {
  accountId: string;
  accountSlug: string;
  connection: MsConnection | null;
  connected: boolean;
  departmentBadges: SignatureDepartmentBadge[];
  departments: string[];
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
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
      toast.success('Microsoft 365 connected');
    }
  }, [connected]);

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

  const disconnect = async () => {
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
            <CardTitle>Microsoft 365 connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {connection ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tenant ID</p>
                    <p className="font-mono text-xs">{connection.ms_tenant_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Connected</p>
                    <p>{new Date(connection.connected_at).toLocaleString()}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={disconnect}
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
