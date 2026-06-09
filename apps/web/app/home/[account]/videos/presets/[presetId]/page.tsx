import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { getDefaultAccountPath } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  configValuesFromRow,
  loadPresetById,
} from '~/lib/videos/server/player-config-data';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { PresetEditorClient } from './_components/preset-editor-client';

type PresetDetailPageProps = {
  params: Promise<{ account: string; presetId: string }>;
};

export const generateMetadata = async () => ({ title: 'Edit preset' });

export default async function PresetDetailPage({ params }: PresetDetailPageProps) {
  const { account, presetId } = await params;
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

  const client = getSupabaseServerClient();
  const preset = await loadPresetById(client, presetId);

  if (!preset || preset.account_id !== workspace.account.id) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={preset.name}
        description="Edit player preset"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <PresetEditorClient
          accountSlug={account}
          presetId={presetId}
          initialConfig={configValuesFromRow(preset)}
        />
      </PageBody>
    </>
  );
}
