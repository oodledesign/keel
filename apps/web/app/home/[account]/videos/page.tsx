import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { redirectIfAddonNotAllowed } from '~/lib/billing/require-addon-access';
import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { getDefaultAccountPath } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';
import { loadVideoLibrary } from '~/lib/videos/server/videos-data';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { VideoLibraryClient } from './_components/video-library-client';

type VideosPageProps = {
  params: Promise<{ account: string }>;
};

export const generateMetadata = async () => ({ title: 'Videos' });

export default async function VideosPage({ params }: VideosPageProps) {
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

  redirectIfAddonNotAllowed(
    account,
    workspace.account.id as string,
    'addon_videos',
  );

  const accountId = workspace.account.id as string;
  const { folders, videos } = await loadVideoLibrary(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Videos"
        description="Upload, organize, and embed hosted videos for this workspace."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <VideoLibraryClient
          accountId={accountId}
          accountSlug={account}
          folders={folders}
          videos={videos}
        />
      </PageBody>
    </>
  );
}
