import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { getDefaultAccountPath } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { configValuesFromRow } from '~/lib/videos/server/player-config-data';
import {
  loadAccountPresets,
  loadAccountVideoSettings,
} from '~/lib/videos/server/player-config-data';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { PresetsLibraryClient } from './_components/presets-library-client';

type PresetsPageProps = {
  params: Promise<{ account: string }>;
};

export const generateMetadata = async () => ({ title: 'Player presets' });

export default async function VideoPresetsPage({ params }: PresetsPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

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
  const [presets, settings] = await Promise.all([
    loadAccountPresets(client, accountId),
    loadAccountVideoSettings(client, accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Player presets"
        description="Reusable embed player configurations for this workspace."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <PresetsLibraryClient
          accountId={accountId}
          accountSlug={account}
          initialPresets={presets.map((preset) => ({
            id: preset.id,
            name: preset.name,
            values: configValuesFromRow(preset),
            isDefault: settings.default_player_preset_id === preset.id,
          }))}
        />
      </PageBody>
    </>
  );
}
