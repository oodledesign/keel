import { notFound } from 'next/navigation';

import { aspectRatioCss, buildEmbedUrl } from '~/lib/videos/embed';
import { formatViewCount } from '~/lib/videos/format';
import { loadPublicVideoByToken } from '~/lib/videos/server/public-video.loader';

import { PublicTimelineWatchPlayer } from './_components/public-timeline-watch-player';

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

  const { video, config, useTimelinePlayer } = data;
  const embedUrl = buildEmbedUrl(
    video.bunny_library_id,
    video.bunny_video_id,
    config,
  );
  const ratio = aspectRatioCss(config.aspect_ratio);
  const isReady = video.status === 'ready';

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-6 space-y-2">
          <p className="text-xs tracking-wide text-[var(--ozer-text-muted)] uppercase">
            Hosted video
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-[var(--ozer-plum-900)] sm:text-3xl">
            {video.title}
          </h1>
          <p className="text-sm text-[var(--ozer-text-muted)]">
            {formatViewCount(video.view_count)}{' '}
            {Number(video.view_count ?? 0) === 1 ? 'view' : 'views'}
          </p>
          {video.description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--ozer-text-muted)]">
              {video.description}
            </p>
          ) : null}
        </header>

        <div
          className="mx-auto w-full overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-black shadow-lg shadow-[color:var(--ozer-plum-900)]/10"
          style={{ maxWidth: config.max_width_px ?? undefined }}
        >
          {useTimelinePlayer ? (
            <PublicTimelineWatchPlayer token={token} aspectRatio={ratio} />
          ) : isReady ? (
            <div className="relative w-full" style={{ aspectRatio: ratio }}>
              <iframe
                src={embedUrl}
                title={video.title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              className="relative flex w-full items-center justify-center bg-black/60"
              style={{ aspectRatio: ratio }}
            >
              {video.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
              ) : null}
              <p className="relative z-10 px-6 text-center text-sm text-[var(--ozer-text-on-dark)]/80">
                {video.status === 'failed'
                  ? 'This video failed to process.'
                  : 'This video is still processing. Check back soon.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
