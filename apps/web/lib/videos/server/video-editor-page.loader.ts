import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { getDefaultAccountPath } from '~/home/[account]/_lib/role-access';
import { isVideosModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '~/home/[account]/_lib/server/workspace-route-guard';
import {
  type VideoTranscriptWord,
  createDefaultTimeline,
  normalizeTimeline,
} from '~/lib/videos/edit-timeline';
import { ensureEditProject } from '~/lib/videos/server/video-edit.service';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export async function loadVideoEditorPage(
  accountSlug: string,
  videoId: string,
) {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ADDON_APPS_SPACE_TYPES);

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
  if (access.error === 'UNAUTHORIZED') redirect('/auth/sign-in');
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    notFound();
  }

  const video = access.video!;
  if (video.account_id !== workspace.account.id) notFound();

  const { data: master } = await access.client
    .from('video_masters')
    .select('duration_ms')
    .eq('video_id', videoId)
    .maybeSingle();

  const durationMs =
    master?.duration_ms ??
    (video.duration_seconds != null
      ? Number(video.duration_seconds) * 1000
      : 0);

  const { project, timeline } = await ensureEditProject({
    client: access.client,
    videoId,
    accountId: video.account_id as string,
    durationMs: Number(durationMs) || 0,
    userId: access.user?.id,
  });

  const { data: transcriptRow } = await access.client
    .from('video_transcripts')
    .select('plain_text, words, status')
    .eq('video_id', videoId)
    .maybeSingle();

  return {
    accountSlug,
    video: {
      id: video.id as string,
      title: video.title as string,
      hasMaster: Boolean(video.has_master),
      editRevision: Number(video.edit_revision ?? project.revision ?? 0),
      publishedRevision: Number(video.published_revision ?? 0),
    },
    timeline: normalizeTimeline(timeline, Number(durationMs) || 0),
    revision: Number(project.revision ?? 1),
    transcript:
      transcriptRow && transcriptRow.status === 'ready'
        ? {
            plainText: String(transcriptRow.plain_text ?? ''),
            words: (transcriptRow.words ?? []) as VideoTranscriptWord[],
          }
        : null,
    fallbackTimeline: createDefaultTimeline(Number(durationMs) || 0),
  };
}
