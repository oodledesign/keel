'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import dynamic from 'next/dynamic';

import { Grid3X3, List, Plus, Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import pathsConfig from '~/config/paths.config';
import { buildPublicVideoWatchUrl } from '~/lib/videos/public-share';
import type {
  VideoFolderRow,
  VideoRow,
  VideoSort,
  VideoStatus,
  VideoViewMode,
} from '~/lib/videos/types';

import { FolderSidebar } from './folder-sidebar';
import { VideoCard } from './video-card';
import { VideoListRow } from './video-list-row';
import { VideoPreviewDialog } from './video-preview-dialog';

const UploadModal = dynamic(
  () => import('./upload-modal').then((mod) => mod.UploadModal),
  { ssr: false },
);

function folderBreadcrumb(
  folderId: string | null,
  folders: VideoFolderRow[],
): VideoFolderRow[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: VideoFolderRow[] = [];
  let current = byId.get(folderId);
  while (current) {
    trail.unshift(current);
    current = current.parent_folder_id
      ? byId.get(current.parent_folder_id)
      : undefined;
  }
  return trail;
}

export function VideoLibraryClient(props: {
  accountId: string;
  accountSlug: string;
  folders: VideoFolderRow[];
  videos: VideoRow[];
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewMode, setViewMode] = useState<VideoViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VideoStatus>('all');
  const [sort, setSort] = useState<VideoSort>('newest');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoRow | null>(null);

  const breadcrumb = folderBreadcrumb(selectedFolderId, props.folders);
  const presetsPath = pathsConfig.app.accountVideoPresets.replace(
    '[account]',
    props.accountSlug,
  );

  const filteredVideos = useMemo(() => {
    let rows = [...props.videos];

    if (selectedFolderId) {
      rows = rows.filter((video) => video.folder_id === selectedFolderId);
    }

    if (statusFilter !== 'all') {
      rows = rows.filter((video) => video.status === statusFilter);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((video) => video.title.toLowerCase().includes(query));
    }

    rows.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case 'name':
          return a.title.localeCompare(b.title);
        case 'duration':
          return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
        case 'newest':
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return rows;
  }, [props.videos, search, selectedFolderId, sort, statusFilter]);

  const copyEmbed = async (video: VideoRow) => {
    try {
      const res = await fetch(`/api/videos/${video.id}/player-config`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load config');

      await navigator.clipboard.writeText(json.data.embedIframe);
      toast.success('Embed code copied');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const copyPublicLink = async (video: VideoRow) => {
    if (!video.public_share_enabled || !video.public_share_token) {
      const playerConfigPath = pathsConfig.app.accountVideoDetail
        .replace('[account]', props.accountSlug)
        .replace('[videoId]', video.id);
      toast.error(
        'Turn on “Public link” on the player config page first, then copy it from here.',
      );
      router.push(playerConfigPath);
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildPublicVideoWatchUrl(video.public_share_token),
      );
      toast.success('Public link copied');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const renameVideo = async (video: VideoRow) => {
    const nextTitle = window.prompt('Rename video', video.title)?.trim();
    if (!nextTitle || nextTitle === video.title) return;

    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Video renamed');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const moveVideo = async (video: VideoRow) => {
    const options = [
      { id: '', label: 'No folder' },
      ...props.folders.map((folder) => ({ id: folder.id, label: folder.name })),
    ];
    const message = options
      .map((option, index) => `${index}: ${option.label}`)
      .join('\n');
    const choice = window.prompt(`Move "${video.title}" — enter folder number:\n${message}`);
    if (choice == null) return;
    const index = Number(choice);
    if (Number.isNaN(index) || index < 0 || index >= options.length) {
      toast.error('Invalid folder selection');
      return;
    }

    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: options[index]?.id ? options[index]!.id : null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Video moved');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteVideo = async (video: VideoRow) => {
    if (!window.confirm(`Delete "${video.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error.message);
      toast.success('Video deleted');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 px-4 lg:px-0">
        <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              className="hover:text-[var(--workspace-shell-text)]"
              onClick={() => setSelectedFolderId(null)}
            >
              All videos
            </button>
            {breadcrumb.map((folder) => (
              <span key={folder.id} className="inline-flex items-center gap-1">
                <span>/</span>
                <button
                  type="button"
                  className="hover:text-[var(--workspace-shell-text)]"
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  {folder.name}
                </button>
              </span>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild className="gap-2">
            <Link href={presetsPath}>
              <SlidersHorizontal className="h-4 w-4" />
              Presets
            </Link>
          </Button>
          <Button
            type="button"
            className="ozer-gradient-btn gap-2"
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Upload Video
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-0">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search videos…"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] p-1">
          <Button
            type="button"
            size="icon"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as 'all' | VideoStatus)
          }
        >
          <SelectTrigger className="w-[10rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="uploading">Uploading</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => setSort(value as VideoSort)}>
          <SelectTrigger className="w-[10rem]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 px-4 lg:px-0">
        <FolderSidebar
          folders={props.folders}
          selectedFolderId={selectedFolderId}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onSelectFolder={setSelectedFolderId}
        />

        <div className="min-w-0 flex-1">
          {filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-black/10 px-6 py-16 text-center">
              <p className="text-lg font-medium">No videos yet</p>
              <p className="text-muted-foreground mt-2 max-w-md text-sm">
                Upload your first video to start building your hosted library.
              </p>
              <Button
                type="button"
                className="ozer-gradient-btn mt-6 gap-2"
                onClick={() => setUploadOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Upload Video
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  accountSlug={props.accountSlug}
                  video={video}
                  onPreview={setPreviewVideo}
                  onCopyEmbed={copyEmbed}
                  onCopyPublicLink={copyPublicLink}
                  onRename={renameVideo}
                  onMove={moveVideo}
                  onDelete={deleteVideo}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
              {filteredVideos.map((video) => (
                <VideoListRow
                  key={video.id}
                  accountSlug={props.accountSlug}
                  video={video}
                  onPreview={setPreviewVideo}
                  onCopyEmbed={copyEmbed}
                  onCopyPublicLink={copyPublicLink}
                  onRename={renameVideo}
                  onMove={moveVideo}
                  onDelete={deleteVideo}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        accountId={props.accountId}
        folders={props.folders}
        defaultFolderId={selectedFolderId}
      />

      <VideoPreviewDialog
        video={previewVideo}
        open={previewVideo != null}
        onOpenChange={(open) => {
          if (!open) setPreviewVideo(null);
        }}
      />
    </div>
  );
}
