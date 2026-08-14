import { notFound } from 'next/navigation';

import { aspectRatioCss } from '~/lib/videos/embed';
import { loadPublicVideoByToken } from '~/lib/videos/server/public-video.loader';

import { PublicWatchClient } from './_components/public-watch-client';

type PublicWatchPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PublicWatchPageProps) {
  const { token } = await params;
  const data = await loadPublicVideoByToken(token);

  if (!data) {
    return { title: 'Video not found' };
  }

  const description =
    data.video.description?.trim() || `Watch ${data.video.title}`;

  return {
    title: data.video.title,
    description,
    openGraph: {
      title: data.video.title,
      description,
      type: 'video.other',
      images: data.video.thumbnail_url
        ? [{ url: data.video.thumbnail_url, alt: data.video.title }]
        : undefined,
    },
    twitter: {
      card: data.video.thumbnail_url ? 'summary_large_image' : 'summary',
      title: data.video.title,
      description,
      images: data.video.thumbnail_url ? [data.video.thumbnail_url] : undefined,
    },
  };
}

export default async function PublicWatchPage({
  params,
}: PublicWatchPageProps) {
  const { token } = await params;
  const data = await loadPublicVideoByToken(token);

  if (!data) {
    notFound();
  }

  const {
    video,
    config,
    useTimelinePlayer,
    chapters,
    publishedAt,
    transcriptPlainText,
    summary,
  } = data;
  const ratio = aspectRatioCss(config.aspect_ratio);
  const isReady = video.status === 'ready';

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
        <PublicWatchClient
          video={video}
          config={config}
          useTimelinePlayer={useTimelinePlayer}
          chapters={chapters}
          publishedAt={publishedAt}
          transcriptPlainText={transcriptPlainText}
          summary={summary}
          aspectRatio={ratio}
          embedReady={isReady}
        />
      </div>
    </main>
  );
}
