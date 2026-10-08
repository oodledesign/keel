'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ChevronRight,
  ExternalLink,
  Eye,
  Folder,
  Gauge,
  Scissors,
  Timer,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  formatDuration,
  formatViewCount,
  formatWatchTime,
} from '~/lib/videos/format';
import {
  type AspectRatio,
  type CaptionTrack,
  DEFAULT_PLAYER_CONFIG,
  type VideoPlayerConfigValues,
} from '~/lib/videos/player-config-types';
import type { VideoChapter, VideoFolderRow } from '~/lib/videos/types';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { EmbedCode } from './embed-code';
import { PlayerConfigEditor } from './player-config-editor';
import { PlayerPreview, type PlayerPreviewHandle } from './player-preview';
import { PublicSharePanel } from './public-share-panel';
import { VideoChaptersEditor } from './video-chapters-editor';
import { VideoSummaryEditor } from './video-summary-editor';
import { VideoThumbnailPanel } from './video-thumbnail-panel';

const NO_FOLDER = '__none__';
const TITLE_MAX = 500;

type FolderOption = Pick<VideoFolderRow, 'id' | 'name' | 'parent_folder_id'>;

function folderTrail(
  folderId: string | null,
  folders: FolderOption[],
): FolderOption[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: FolderOption[] = [];
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !trail.includes(current)) {
    trail.unshift(current);
    current = current.parent_folder_id
      ? byId.get(current.parent_folder_id)
      : undefined;
  }
  return trail;
}

function SectionHeader(props: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={`text-base font-semibold ${workspaceText}`}>
          {props.title}
        </h2>
        {props.description ? (
          <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
            {props.description}
          </p>
        ) : null}
      </div>
      {props.action}
    </div>
  );
}

function Fact(props: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={`text-xs ${workspaceTextMuted}`}>{props.label}</dt>
      <dd className={`mt-0.5 truncate text-sm ${workspaceText}`}>
        {props.children}
      </dd>
    </div>
  );
}

function Stat(props: {
  icon: ReactNode;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="px-3 py-3 text-center" title={props.title}>
      <p
        className={`inline-flex items-center gap-1 text-[11px] tracking-wide uppercase ${workspaceTextMuted}`}
      >
        {props.icon}
        {props.label}
      </p>
      <p
        className={`mt-0.5 text-lg font-semibold tracking-tight tabular-nums ${workspaceText}`}
      >
        {props.value}
      </p>
    </div>
  );
}

export function PlayerConfigPageClient(props: {
  accountSlug: string;
  video: {
    id: string;
    title: string;
    folderId: string | null;
    durationSeconds: number | null;
    createdAt: string;
    originalFilename: string | null;
    bunny_library_id: string;
    bunny_video_id: string;
    status: string;
    thumbnailUrl: string | null;
    thumbnailCustom: boolean;
    viewCount: number;
    watchTimeSeconds: number;
    engagementScore: number | null;
    analyticsSyncedAt: string | null;
    publicShareEnabled: boolean;
    publicShareToken: string | null;
    publicShareUrl: string | null;
    publishedAt: string | null;
    chapters: VideoChapter[];
    summary: string | null;
  };
  folders: FolderOption[];
  transcriptPlainText: string | null;
  initialConfig: VideoPlayerConfigValues;
  initialPresets: Array<{
    id: string;
    name: string;
    values: VideoPlayerConfigValues;
  }>;
  initialCaptions: CaptionTrack[];
  detectedAspectRatio: AspectRatio;
  cdnHostname: string;
}) {
  const router = useRouter();
  const previewRef = useRef<PlayerPreviewHandle>(null);
  const previewAnchorRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState(props.initialConfig);
  const [presets, setPresets] = useState(props.initialPresets);
  const [captions, setCaptions] = useState(props.initialCaptions);
  const [title, setTitle] = useState(props.video.title);
  const [saving, setSaving] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [uploadingCaption, setUploadingCaption] = useState(false);
  const [syncingCaptions, setSyncingCaptions] = useState(false);
  const [folderId, setFolderId] = useState(props.video.folderId);
  const [movingFolder, setMovingFolder] = useState(false);
  const [publicUrl, setPublicUrl] = useState(props.video.publicShareUrl);

  const handleSeek = useCallback((ms: number) => {
    previewAnchorRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    previewRef.current?.seekToPlaybackMs(ms);
  }, []);

  useEffect(() => {
    setTitle(props.video.title);
  }, [props.video.title]);

  useEffect(() => {
    setFolderId(props.video.folderId);
  }, [props.video.folderId]);

  const persistConfig = useCallback(
    async (nextConfig: VideoPlayerConfigValues) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/videos/${props.video.id}/player-config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextConfig),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error?.message ?? 'Save failed');
        setConfig(json.data.config);
        toast.success('Player config saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [props.video.id],
  );

  const patchConfig = (patch: Partial<VideoPlayerConfigValues>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const handleSave = () => void persistConfig(config);

  const handleBlurSave = () => void persistConfig(config);

  const saveTitle = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error('Video name can’t be empty');
      setTitle(props.video.title);
      return;
    }
    if (nextTitle === props.video.title) return;

    setSavingTitle(true);
    try {
      const res = await fetch(`/api/videos/${props.video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Rename failed');
      setTitle(nextTitle);
      toast.success('Video renamed');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setTitle(props.video.title);
    } finally {
      setSavingTitle(false);
    }
  };

  const moveToFolder = async (value: string) => {
    const nextFolderId = value === NO_FOLDER ? null : value;
    if (nextFolderId === folderId) return;

    const previous = folderId;
    setFolderId(nextFolderId);
    setMovingFolder(true);
    try {
      const res = await fetch(`/api/videos/${props.video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: nextFolderId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Move failed');
      toast.success(nextFolderId ? 'Moved to folder' : 'Removed from folder');
      router.refresh();
    } catch (error) {
      setFolderId(previous);
      toast.error(getErrorMessage(error));
    } finally {
      setMovingFolder(false);
    }
  };

  const handleReset = () => {
    setConfig({
      ...DEFAULT_PLAYER_CONFIG,
      aspect_ratio: props.detectedAspectRatio,
    });
    toast.message('Reset to defaults — save to apply');
  };

  const handleLoadPreset = (values: VideoPlayerConfigValues) => {
    setConfig({ ...values, name: config.name });
    toast.success('Preset applied — save to persist');
  };

  const handleSavePreset = async (name: string) => {
    const res = await fetch(`/api/videos/${props.video.id}/player-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-preset',
        name,
        config,
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? 'Preset save failed');

    const preset = json.data.preset;
    setPresets((current) =>
      [...current, preset].sort((a, b) => a.name.localeCompare(b.name)),
    );
    toast.success('Preset saved');
  };

  const handleUploadCaption = async (
    file: File,
    srclang: string,
    label: string,
  ) => {
    setUploadingCaption(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('srclang', srclang);
      form.append('label', label);

      const res = await fetch(`/api/videos/${props.video.id}/captions`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Upload failed');

      setCaptions(json.data.captions);
      toast.success('Caption uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingCaption(false);
    }
  };

  const handleSyncTranscriptCaptions = async () => {
    setSyncingCaptions(true);
    try {
      const res = await fetch(
        `/api/videos/${props.video.id}/captions/sync-transcript`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Sync failed');

      setCaptions(json.data.captions);
      toast.success('Captions generated from transcript');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSyncingCaptions(false);
    }
  };

  const videosPath = pathsConfig.app.accountVideos.replace(
    '[account]',
    props.accountSlug,
  );
  const trail = folderTrail(folderId, props.folders);
  const folderLabel = (id: string) =>
    folderTrail(id, props.folders)
      .map((folder) => folder.name)
      .join(' / ');
  const ready = props.video.status === 'ready';
  const uploadedLabel = new Date(props.video.createdAt).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );

  return (
    <div className="space-y-5 px-4 lg:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className={`flex min-w-0 flex-wrap items-center gap-1 text-sm ${workspaceTextMuted}`}
        >
          <Link
            href={videosPath}
            className="hover:text-[var(--workspace-shell-text)]"
          >
            Videos
          </Link>
          {trail.map((folder) => (
            <span key={folder.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <Link
                href={`${videosPath}?folder=${folder.id}`}
                className="inline-flex items-center gap-1 hover:text-[var(--workspace-shell-text)]"
              >
                <Folder className="h-3.5 w-3.5" aria-hidden />
                {folder.name}
              </Link>
            </span>
          ))}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className={`max-w-[20rem] truncate ${workspaceText}`}>
            {title || props.video.title}
          </span>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {publicUrl ? (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                View public page
              </a>
            </Button>
          ) : null}
          <Link
            href={`${videosPath}/${props.video.id}/edit`}
            className={workspaceBtnPrimaryMd}
          >
            <Scissors className="h-4 w-4" aria-hidden />
            Edit recording
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <aside className="lg:sticky lg:top-6 lg:order-2 lg:self-start">
          <div
            ref={previewAnchorRef}
            className={`${workspacePanelCard} overflow-hidden`}
          >
            <PlayerPreview
              ref={previewRef}
              bare
              libraryId={props.video.bunny_library_id}
              bunnyVideoId={props.video.bunny_video_id}
              videoId={props.video.id}
              ready={ready}
              config={config}
            />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
              <div className="col-span-2">
                <Fact label="Folder">
                  {trail.length
                    ? trail.map((folder) => folder.name).join(' / ')
                    : 'No folder'}
                </Fact>
              </div>
              {props.video.originalFilename ? (
                <div className="col-span-2">
                  <Fact label="Filename">{props.video.originalFilename}</Fact>
                </div>
              ) : null}
              <Fact label="Duration">
                {formatDuration(props.video.durationSeconds)}
              </Fact>
              <Fact label="Uploaded">{uploadedLabel}</Fact>
            </dl>

            <div className="grid grid-cols-3 divide-x divide-[color:var(--workspace-shell-border)] border-t border-[color:var(--workspace-shell-border)]">
              <Stat
                icon={<Eye className="h-3 w-3" aria-hidden />}
                label="Views"
                value={formatViewCount(props.video.viewCount)}
              />
              <Stat
                icon={<Timer className="h-3 w-3" aria-hidden />}
                label="Watch time"
                value={formatWatchTime(props.video.watchTimeSeconds)}
              />
              <Stat
                icon={<Gauge className="h-3 w-3" aria-hidden />}
                label="Engagement"
                value={
                  props.video.engagementScore != null
                    ? `${props.video.engagementScore}`
                    : '—'
                }
                title={
                  props.video.analyticsSyncedAt
                    ? `Updated ${new Date(
                        props.video.analyticsSyncedAt,
                      ).toLocaleString('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}`
                    : 'Syncing from Bunny…'
                }
              />
            </div>
          </div>

          <div className={`${workspacePanelCard} mt-4 p-5`}>
            <PublicSharePanel
              videoId={props.video.id}
              videoTitle={title}
              initialEnabled={props.video.publicShareEnabled}
              initialToken={props.video.publicShareToken}
              initialPublicUrl={props.video.publicShareUrl}
              videoReady={ready}
              onChange={(state) =>
                setPublicUrl(state.enabled ? state.publicUrl : null)
              }
            />
          </div>
        </aside>

        <div className="min-w-0 space-y-5 lg:order-1">
          <section className={`${workspacePanelCard} space-y-5 p-5`}>
            <SectionHeader
              title="Details"
              description="Shown on the public watch page and in your video library."
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="video-title">Title</Label>
                <span className={`text-xs tabular-nums ${workspaceTextMuted}`}>
                  {title.length}/{TITLE_MAX}
                </span>
              </div>
              <Input
                id="video-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveTitle();
                  }
                }}
                maxLength={TITLE_MAX}
                disabled={savingTitle}
                className="h-11 bg-[var(--workspace-shell-canvas)] text-base"
              />
              <p className={`text-xs ${workspaceTextMuted}`}>
                {savingTitle ? 'Saving…' : 'Saves when you click away.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="video-folder">Folder</Label>
              <Select
                value={folderId ?? NO_FOLDER}
                disabled={movingFolder}
                onValueChange={(value) => void moveToFolder(value)}
              >
                <SelectTrigger
                  id="video-folder"
                  className="bg-[var(--workspace-shell-canvas)] sm:max-w-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                  {props.folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folderLabel(folder.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <VideoSummaryEditor
              embedded
              videoId={props.video.id}
              initialSummary={props.video.summary}
              transcriptPlainText={props.transcriptPlainText}
            />
          </section>

          <section className={`${workspacePanelCard} p-5`}>
            <VideoThumbnailPanel
              videoId={props.video.id}
              mp4Url={
                props.cdnHostname
                  ? `https://${props.cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${props.video.bunny_video_id}/play_720p.mp4`
                  : null
              }
              currentThumbnailUrl={
                props.video.thumbnailUrl ??
                (props.cdnHostname
                  ? `https://${props.cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${props.video.bunny_video_id}/thumbnail.jpg`
                  : null)
              }
              isCustom={props.video.thumbnailCustom}
              disabled={!ready}
            />
          </section>

          <VideoChaptersEditor
            key={props.video.id}
            chaptersOnly
            videoId={props.video.id}
            initialChapters={props.video.chapters}
            initialSummary={props.video.summary}
            transcriptPlainText={props.transcriptPlainText}
            publishedAt={props.video.publishedAt}
            onSeek={handleSeek}
          />

          <PlayerConfigEditor
            config={config}
            detectedAspectRatio={props.detectedAspectRatio}
            captions={captions}
            presets={presets}
            saving={saving}
            onChange={patchConfig}
            onSave={handleSave}
            onBlurSave={handleBlurSave}
            onReset={handleReset}
            onLoadPreset={handleLoadPreset}
            onSavePreset={handleSavePreset}
            onUploadCaption={handleUploadCaption}
            uploadingCaption={uploadingCaption}
            onSyncTranscriptCaptions={handleSyncTranscriptCaptions}
            syncingCaptions={syncingCaptions}
          />

          <section className={`${workspacePanelCard} p-5`}>
            <EmbedCode
              libraryId={props.video.bunny_library_id}
              bunnyVideoId={props.video.bunny_video_id}
              cdnHostname={props.cdnHostname}
              config={config}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
