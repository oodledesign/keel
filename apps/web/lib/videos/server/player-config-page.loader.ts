import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { createBunnyStreamClient } from '@kit/bunny';

import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { getDefaultAccountPath } from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';

import {
  configValuesFromRow,
  loadAccountPresets,
  loadVideoPlayerConfig,
  resolveEffectivePlayerConfig,
} from './player-config-data';
import { requireVideoById } from './videos-access';
import { getBunnyCdnHostname } from './videos-data';

export async function loadVideoPlayerConfigPage(
  accountSlug: string,
  videoId: string,
) {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  if (!isVideosModuleEnabled(workspace.moduleSettings)) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const access = await requireVideoById(videoId);

  if (access.error === 'UNAUTHORIZED') {
    redirect('/auth/sign-in');
  }

  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    notFound();
  }

  const video = access.video!;
  const accountId = video.account_id as string;

  if (video.account_id !== workspace.account.id) {
    notFound();
  }

  const [configRow, presets, resolved] = await Promise.all([
    loadVideoPlayerConfig(access.client, videoId),
    loadAccountPresets(access.client, accountId),
    resolveEffectivePlayerConfig(access.client, accountId, videoId),
  ]);

  const bunny = createBunnyStreamClient();
  const captions = await bunny.listCaptions(
    String(video.bunny_library_id),
    String(video.bunny_video_id),
  );

  return {
    accountSlug,
    accountId,
    video: {
      id: video.id as string,
      title: video.title as string,
      bunny_library_id: String(video.bunny_library_id),
      bunny_video_id: String(video.bunny_video_id),
      status: video.status as string,
    },
    config: configRow ? configValuesFromRow(configRow) : resolved.config,
    configSource: configRow ? 'video' : resolved.source,
    configId: configRow?.id ?? null,
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      values: configValuesFromRow(preset),
    })),
    captions,
    cdnHostname: getBunnyCdnHostname(),
  };
}
