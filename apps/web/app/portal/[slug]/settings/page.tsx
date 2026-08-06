import Link from 'next/link';

import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import { PortalAvatarForm } from '../_components/portal-avatar-form';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';

interface PortalSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Settings' });

export default async function PortalSettingsPage({
  params,
}: PortalSettingsPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Settings
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Manage your profile for the {ctx.orgName} client portal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PortalAvatarForm
            clientOrgId={ctx.clientOrgId}
            initialPictureUrl={ctx.userAvatarUrl}
            hasContactRecord={ctx.hasContactRecord}
          />
          <div>
            <p className="text-sm text-[var(--ozer-text-on-light)]">
              Display name
            </p>
            <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
              {ctx.displayName} — set by your account manager. Ask them to
              update it if it&apos;s wrong.
            </p>
          </div>
        </CardContent>
      </Card>

      {!ctx.hasWorkspaceAccess ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Sparkles className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
            <CardTitle className="text-base font-medium">
              Want your own workspace?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              Create your own personal or family workspace for free —
              separate from this client portal. You can always come back here
              from your dashboard.
            </p>
            <Button asChild>
              <Link href={`${pathsConfig.app.workspaceSetup}?start=1`}>
                Create your own workspace for free
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
