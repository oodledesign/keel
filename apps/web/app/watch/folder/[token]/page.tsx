import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Play } from 'lucide-react';

import { formatDuration, formatPublishedAt } from '~/lib/videos/format';
import { buildPublicFolderVideoWatchPath } from '~/lib/videos/public-share';
import { loadPublicFolderByToken } from '~/lib/videos/server/public-folder.loader';

import { FolderVideoMenu } from './_components/folder-video-menu';

type PublicFolderPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PublicFolderPageProps) {
  const { token } = await params;
  const data = await loadPublicFolderByToken(token);

  if (!data) {
    return { title: 'Folder not found' };
  }

  const description = `${data.totalVideos} ${
    data.totalVideos === 1 ? 'video' : 'videos'
  }`;

  return {
    title: data.folder.name,
    description,
    // Shared by link only — keep it out of search results.
    robots: { index: false, follow: false },
    openGraph: { title: data.folder.name, description },
  };
}

export default async function PublicFolderPage({
  params,
}: PublicFolderPageProps) {
  const { token } = await params;
  const data = await loadPublicFolderByToken(token);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 space-y-2">
          <p className="text-sm font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
            Video folder
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-plum-900)] sm:text-4xl">
            {data.folder.name}
          </h1>
          <p className="text-base text-[var(--ozer-text-on-light-muted)]">
            {data.totalVideos} {data.totalVideos === 1 ? 'video' : 'videos'}
          </p>
        </header>

        {data.totalVideos === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--ozer-border-on-light)] px-6 py-16 text-center text-base text-[var(--ozer-text-on-light-muted)]">
            There are no videos to watch in this folder yet.
          </p>
        ) : (
          <div className="space-y-10">
            {data.sections.map((section) => (
              <section key={section.id} className="space-y-4">
                {section.title ? (
                  <h2 className="font-heading text-xl font-semibold text-[var(--ozer-plum-900)]">
                    {section.title}
                  </h2>
                ) : null}

                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.videos.map((video) => {
                    const published = formatPublishedAt(video.created_at);

                    return (
                      <li
                        key={video.id}
                        className="relative overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white shadow-sm transition hover:shadow-md"
                      >
                        <Link
                          href={buildPublicFolderVideoWatchPath(
                            token,
                            video.id,
                          )}
                          className="group block"
                        >
                          <div className="relative aspect-video bg-black">
                            {video.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={video.thumbnail_url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
                              <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-[var(--ozer-plum-900)] shadow">
                                <Play className="ml-0.5 size-5" aria-hidden />
                              </span>
                            </span>
                            {video.duration_seconds ? (
                              <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                                {formatDuration(video.duration_seconds)}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className={`space-y-0.5 py-3 pl-4 ${data.allowDownload ? 'pr-12' : 'pr-4'}`}
                          >
                            <p className="line-clamp-2 text-base font-medium text-[var(--ozer-plum-900)]">
                              {video.title}
                            </p>
                            {published ? (
                              <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                                {published}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                        {data.allowDownload ? (
                          <div className="absolute right-2 bottom-2">
                            <FolderVideoMenu
                              title={video.title}
                              downloadUrl={`/api/watch/folder/${token}/${video.id}/download`}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
