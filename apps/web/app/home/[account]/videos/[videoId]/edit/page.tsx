import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { loadVideoEditorPage } from '~/lib/videos/server/video-editor-page.loader';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { VideoEditorClient } from './_components/video-editor-client';

type Props = {
  params: Promise<{ account: string; videoId: string }>;
};

export const generateMetadata = async () => ({ title: 'Edit video' });

async function VideoEditorPage({ params }: Props) {
  const { account, videoId } = await params;
  const data = await loadVideoEditorPage(account, videoId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title={data.video.title}
        description="Trim, zoom, click highlights, and transcript cuts — then update the published video."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <VideoEditorClient
          accountSlug={data.accountSlug}
          videoId={data.video.id}
          videoTitle={data.video.title}
          hasMaster={data.video.hasMaster}
          initialTimeline={data.timeline}
          initialRevision={data.revision}
          publishedRevision={data.video.publishedRevision}
          initialTranscript={data.transcript}
          initialHasChapters={data.video.hasChapters}
          initialHasSummary={data.video.hasSummary}
        />
      </PageBody>
    </>
  );
}

export default withI18n(VideoEditorPage);
