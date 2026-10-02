import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { aspectRatioCss } from '~/lib/videos/embed';
import { buildPublicFolderWatchPath } from '~/lib/videos/public-share';
import { loadPublicFolderVideo } from '~/lib/videos/server/public-folder.loader';
import { PublicWatchClient } from '~/watch/[token]/_components/public-watch-client';

type PublicFolderVideoPageProps = {
  params: Promise<{ token: string; videoId: string }>;
};

export async function generateMetadata({ params }: PublicFolderVideoPageProps) {
  const { token, videoId } = await params;
  const data = await loadPublicFolderVideo(token, videoId);

  if (!data) {
    return { title: 'Video not found' };
  }

  const { video } = data.page;
  const description = video.description?.trim() || `Watch ${video.title}`;

  return {
    title: video.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: video.title,
      description,
      type: 'video.other',
      images: video.thumbnail_url
        ? [{ url: video.thumbnail_url, alt: video.title }]
        : undefined,
    },
  };
}

export default async function PublicFolderVideoPage({
  params,
}: PublicFolderVideoPageProps) {
  const { token, videoId } = await params;
  const data = await loadPublicFolderVideo(token, videoId);

  if (!data) {
    notFound();
  }

  const {
    video,
    config,
    useTimelinePlayer,
    streamMatchesPublishedEdit,
    chapters,
    publishedAt,
    transcriptPlainText,
    summary,
  } = data.page;

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href={buildPublicFolderWatchPath(token)}
          className="mb-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[var(--ozer-text-on-light-muted)] transition hover:text-[var(--ozer-plum-900)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {data.folder.name}
        </Link>

        <PublicWatchClient
          video={video}
          mediaUrl={`/api/watch/folder/${token}/${video.id}/media`}
          config={config}
          useTimelinePlayer={useTimelinePlayer}
          streamMatchesPublishedEdit={streamMatchesPublishedEdit}
          chapters={chapters}
          publishedAt={publishedAt}
          transcriptPlainText={transcriptPlainText}
          summary={summary}
          aspectRatio={aspectRatioCss(config.aspect_ratio)}
          embedReady={video.status === 'ready'}
        />
      </div>
    </main>
  );
}
