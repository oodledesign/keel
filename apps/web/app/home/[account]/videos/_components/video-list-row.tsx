'use client';

import Link from 'next/link';
import { Loader2, MoreHorizontal } from 'lucide-react';

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

import { VideoThumbnail } from './video-thumbnail';

export function VideoListRow(props: {
  accountSlug: string;
  video: VideoRow;
  onPreview: (video: VideoRow) => void;
  onCopyEmbed: (video: VideoRow) => void;
  onCopyPublicLink: (video: VideoRow) => void;
  onRename: (video: VideoRow) => void;
  onMove: (video: VideoRow) => void;
  onDelete: (video: VideoRow) => void;
}) {
  const { video } = props;

  const playerConfigPath = pathsConfig.app.accountVideoDetail
    .replace('[account]', props.accountSlug)
    .replace('[videoId]', video.id);

  return (
    <div className="flex items-center gap-4 border-b border-white/5 px-4 py-3 last:border-0">
      <button
        type="button"
        className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-black/40"
        onClick={() => props.onPreview(video)}
        aria-label={`Play ${video.title}`}
      >
        <VideoThumbnail
          candidates={video.thumbnail_candidates ?? []}
          alt={video.title}
          className="object-cover"
        />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{video.title}</p>
        <p className="text-muted-foreground text-xs">
          {formatDuration(video.duration_seconds)} ·{' '}
          {new Date(video.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {video.status === 'processing' || video.status === 'uploading' ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {video.status}
          </span>
        ) : null}
        {video.status === 'failed' ? (
          <span className="text-xs text-red-400">Failed</span>
        ) : null}
        {video.status === 'ready' ? (
          <span className="text-xs text-[var(--keel-teal)]">Ready</span>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => props.onCopyEmbed(video)}>
              Copy embed code
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onCopyPublicLink(video)}>
              Copy public link
            </DropdownMenuItem>
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
    </div>
  );
}
