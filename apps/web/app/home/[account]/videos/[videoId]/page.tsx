import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { loadVideoPlayerConfigPage } from '~/lib/videos/server/player-config-page.loader';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { PlayerConfigPageClient } from './_components/player-config-page-client';

type VideoPlayerConfigPageProps = {
  params: Promise<{ account: string; videoId: string }>;
};

export const generateMetadata = async () => ({ title: 'Player config' });

async function VideoPlayerConfigPage({ params }: VideoPlayerConfigPageProps) {
  const { account, videoId } = await params;
  const data = await loadVideoPlayerConfigPage(account, videoId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={data.accountSlug}
        title={data.video.title}
        description="Configure the embed player and copy embed code."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <PlayerConfigPageClient
          accountSlug={data.accountSlug}
          video={data.video}
          initialConfig={data.config}
          initialPresets={data.presets}
          initialCaptions={data.captions}
          detectedAspectRatio={data.detectedAspectRatio}
          cdnHostname={data.cdnHostname}
        />
      </PageBody>
    </>
  );
}

export default withI18n(VideoPlayerConfigPage);
