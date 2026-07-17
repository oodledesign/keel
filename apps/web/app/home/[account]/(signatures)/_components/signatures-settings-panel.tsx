'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { PlugZap, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type {
  GoogleConnection,
  MsConnection,
} from '../_lib/server/signatures-data';
import {
  connectGoogleWorkspaceAction,
  disconnectGoogleWorkspaceAction,
  disconnectMicrosoft365,
} from '../_lib/server/signatures-module-actions';

export function SignaturesSettingsPanel({
  accountId,
  accountSlug,
  msConnection,
  googleConnection,
  connected,
}: {
  accountId: string;
  accountSlug: string;
  msConnection: MsConnection | null;
  googleConnection: GoogleConnection | null;
  connected: boolean;
}) {
  const router = useRouter();
  const [msDisconnecting, setMsDisconnecting] = useState(false);
  const [googleState, setGoogleState] = useState({
    connecting: false,
    disconnecting: false,
    primaryDomain: googleConnection?.primary_domain ?? '',
    delegatedAdminEmail: googleConnection?.delegated_admin_email ?? '',
  });

  const connectedToastFired = useRef(false);
  useEffect(() => {
    if (connected && !connectedToastFired.current) {
      connectedToastFired.current = true;
      if (googleConnection) {
        toast.success('Google Workspace connected');
      } else if (msConnection) {
        toast.success('Microsoft 365 connected');
      }
    }
  }, [connected, googleConnection, msConnection]);

  const connectHref = `/api/signatures/ms-auth?${new URLSearchParams({
    account_id: accountId,
    account_slug: accountSlug,
  }).toString()}`;

  const disconnectMs = async () => {
    setMsDisconnecting(true);
    try {
      await disconnectMicrosoft365({ accountId });
      toast.success('Microsoft 365 disconnected');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setMsDisconnecting(false);
    }
  };

  const connectGoogle = async () => {
    const domain = googleState.primaryDomain.trim().toLowerCase();
    const adminEmail = googleState.delegatedAdminEmail.trim().toLowerCase();

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

    setGoogleState((prev) => ({ ...prev, connecting: true }));
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
      setGoogleState((prev) => ({ ...prev, connecting: false }));
    }
  };

  const disconnectGoogle = async () => {
    setGoogleState((prev) => ({ ...prev, disconnecting: true }));
    try {
      await disconnectGoogleWorkspaceAction({ accountId });
      toast.success('Google Workspace disconnected');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setGoogleState((prev) => ({ ...prev, disconnecting: false }));
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
              <div className="grid gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 text-sm">
                <div>
                  <p className="text-[var(--workspace-shell-text-muted)]">
                    Primary domain
                  </p>
                  <p className="font-mono text-xs">
                    {googleConnection.primary_domain}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--workspace-shell-text-muted)]">
                    Delegated admin
                  </p>
                  <p className="font-mono text-xs">
                    {googleConnection.delegated_admin_email}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--workspace-shell-text-muted)]">
                    Connected
                  </p>
                  <p>
                    {new Date(googleConnection.connected_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={disconnectGoogle}
                disabled={googleState.disconnecting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {googleState.disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--ozer-accent-subtle)] p-2 text-[var(--ozer-accent)]">
                  <PlugZap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Connect Google Workspace</h3>
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
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
                    value={googleState.primaryDomain}
                    onChange={(event) =>
                      setGoogleState((prev) => ({
                        ...prev,
                        primaryDomain: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-admin-email">
                    Delegated admin email
                  </Label>
                  <Input
                    id="google-admin-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={googleState.delegatedAdminEmail}
                    onChange={(event) =>
                      setGoogleState((prev) => ({
                        ...prev,
                        delegatedAdminEmail: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={connectGoogle}
                disabled={
                  googleState.connecting ||
                  !googleState.primaryDomain.trim() ||
                  !googleState.delegatedAdminEmail.trim()
                }
              >
                {googleState.connecting
                  ? 'Connecting...'
                  : 'Connect Google Workspace'}
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
              <div className="grid gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 text-sm">
                <div>
                  <p className="text-[var(--workspace-shell-text-muted)]">
                    Tenant ID
                  </p>
                  <p className="font-mono text-xs">
                    {msConnection.ms_tenant_id}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--workspace-shell-text-muted)]">
                    Connected
                  </p>
                  <p>{new Date(msConnection.connected_at).toLocaleString()}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={disconnectMs}
                disabled={msDisconnecting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {msDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--ozer-accent-subtle)] p-2 text-[var(--ozer-accent)]">
                  <PlugZap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">No Microsoft tenant connected</h3>
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
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
    </div>
  );
}
