'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Loader2, MoreHorizontal, Play } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import { formatDuration } from '~/lib/videos/format';
import type { VideoRow } from '~/lib/videos/types';
import pathsConfig from '~/config/paths.config';

export function VideoCard(props: {
  accountSlug: string;
  video: VideoRow;
  onCopyEmbed: (video: VideoRow) => void;
  onCopyPublicLink: (video: VideoRow) => void;
  onRename: (video: VideoRow) => void;
  onMove: (video: VideoRow) => void;
  onDelete: (video: VideoRow) => void;
}) {
  const { video } = props;
  const thumb =
    video.thumbnail_url ??
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%23111827" width="100%25" height="100%25"/%3E%3C/svg%3E';

  const playerConfigPath = pathsConfig.app.accountVideoDetail
    .replace('[account]', props.accountSlug)
    .replace('[videoId]', video.id);

  return (
    <article className="group overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="relative aspect-video overflow-hidden bg-black/40">
        <Image
          src={thumb}
          alt={video.title}
          fill
          unoptimized
          className="object-cover transition group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <Play className="h-10 w-10 text-white" />
        </div>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(video.duration_seconds)}
        </span>
        {video.status === 'processing' || video.status === 'uploading' ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
            <Loader2 className="h-3 w-3 animate-spin" />
            {video.status === 'uploading' ? 'Uploading' : 'Processing'}
          </span>
        ) : null}
        {video.status === 'failed' ? (
          <span className="absolute left-2 top-2 rounded bg-red-500/90 px-2 py-0.5 text-xs text-white">
            Failed
          </span>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{video.title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {new Date(video.created_at).toLocaleDateString()}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => props.onCopyEmbed(video)}>
              Copy embed code
            </DropdownMenuItem>
            {video.public_share_enabled && video.public_share_token ? (
              <DropdownMenuItem onClick={() => props.onCopyPublicLink(video)}>
                Copy public link
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href={playerConfigPath}>Edit player config</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onMove(video)}>
              Move to folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onRename(video)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400"
              onClick={() => props.onDelete(video)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
