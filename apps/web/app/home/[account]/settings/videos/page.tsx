import { redirect } from 'next/navigation';

import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadAccountPresets,
  loadAccountVideoSettings,
} from '~/lib/videos/server/player-config-data';
import { toPublicVideoSettings } from '~/lib/videos/video-settings';

import { VideoSettingsForm } from './_components/video-settings-form';

type VideoSettingsPageProps = {
  params: Promise<{ account: string }>;
};

export const generateMetadata = async () => ({ title: 'Video settings' });

export default async function VideoSettingsPage({ params }: VideoSettingsPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  if (!isVideosModuleEnabled(workspace.moduleSettings)) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [settings, presets] = await Promise.all([
    loadAccountVideoSettings(client, accountId),
    loadAccountPresets(client, accountId),
  ]);

  return (
    <VideoSettingsForm
      accountId={accountId}
      accountSlug={account}
      initialSettings={toPublicVideoSettings(settings)}
      presets={presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
      }))}
      canEdit={access.isOwner || access.isAdmin}
    />
  );
}
