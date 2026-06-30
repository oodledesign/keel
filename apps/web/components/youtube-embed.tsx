'use client';

import { youtubeEmbedUrl, youtubeVideoId } from '~/lib/youtube-embed';

type YoutubeEmbedProps = {
  url: string;
  title?: string;
  className?: string;
};

export function YoutubeEmbed({ url, title = 'YouTube video', className }: YoutubeEmbedProps) {
  const embedSrc = youtubeEmbedUrl(url);
  const id = youtubeVideoId(url);

  if (!embedSrc || !id) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--ozer-accent-muted)] underline"
      >
        {url}
      </a>
    );
  }

  return (
    <div
      className={
        className ??
        'aspect-video w-full overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/40'
      }
    >
      <iframe
        src={embedSrc}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
