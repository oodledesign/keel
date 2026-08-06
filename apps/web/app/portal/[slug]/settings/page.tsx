import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { PortalAvatarForm } from '../_components/portal-avatar-form';
import { PortalNameForm } from '../_components/portal-name-form';
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
          <PortalAvatarForm initialPictureUrl={ctx.userAvatarUrl} />
          <PortalNameForm userId={ctx.userId} initialName={ctx.displayName} />
        </CardContent>
      </Card>
    </div>
  );
}
