'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Eye, Timer } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { formatViewCount, formatWatchTime } from '~/lib/videos/format';
import {
  type AspectRatio,
  type CaptionTrack,
  DEFAULT_PLAYER_CONFIG,
  type VideoPlayerConfigValues,
} from '~/lib/videos/player-config-types';

import { EmbedCode } from './embed-code';
import { PlayerConfigEditor } from './player-config-editor';
import { PlayerPreview } from './player-preview';
import { PublicSharePanel } from './public-share-panel';

export function PlayerConfigPageClient(props: {
  accountSlug: string;
  video: {
    id: string;
    title: string;
    bunny_library_id: string;
    bunny_video_id: string;
    status: string;
    viewCount: number;
    watchTimeSeconds: number;
    engagementScore: number | null;
    analyticsSyncedAt: string | null;
    publicShareEnabled: boolean;
    publicShareToken: string | null;
    publicShareUrl: string | null;
  };
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
  const [config, setConfig] = useState(props.initialConfig);
  const [presets, setPresets] = useState(props.initialPresets);
  const [captions, setCaptions] = useState(props.initialCaptions);
  const [title, setTitle] = useState(props.video.title);
  const [saving, setSaving] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [uploadingCaption, setUploadingCaption] = useState(false);

  useEffect(() => {
    setTitle(props.video.title);
  }, [props.video.title]);

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

  const videosPath = pathsConfig.app.accountVideos.replace(
    '[account]',
    props.accountSlug,
  );

  return (
    <div className="space-y-6 px-4 lg:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={videosPath}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-sm hover:text-[var(--workspace-shell-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to videos
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs tracking-wide uppercase">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Views
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatViewCount(props.video.viewCount)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs tracking-wide uppercase">
            <Timer className="h-3.5 w-3.5" aria-hidden />
            Watch time
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatWatchTime(props.video.watchTimeSeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Engagement
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {props.video.engagementScore != null
              ? `${props.video.engagementScore}`
              : '—'}
          </p>
          {props.video.analyticsSyncedAt ? (
            <p className="text-muted-foreground mt-1 text-[11px]">
              Updated{' '}
              {new Date(props.video.analyticsSyncedAt).toLocaleString('en-GB', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-[11px]">
              Syncing from Bunny…
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <div className="space-y-2">
          <Label htmlFor="video-title">Video name</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              maxLength={500}
              disabled={savingTitle}
              className="bg-[var(--workspace-shell-panel)]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={savingTitle || title.trim() === props.video.title}
              onClick={() => void saveTitle()}
            >
              {savingTitle ? 'Saving…' : 'Save name'}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Shown on the public watch page and in your video library.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-6">
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
          />

          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <PublicSharePanel
              videoId={props.video.id}
              videoTitle={title}
              initialEnabled={props.video.publicShareEnabled}
              initialToken={props.video.publicShareToken}
              initialPublicUrl={props.video.publicShareUrl}
              videoReady={props.video.status === 'ready'}
            />
          </div>

          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <EmbedCode
              libraryId={props.video.bunny_library_id}
              bunnyVideoId={props.video.bunny_video_id}
              cdnHostname={props.cdnHostname}
              config={config}
            />
          </div>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <PlayerPreview
              libraryId={props.video.bunny_library_id}
              bunnyVideoId={props.video.bunny_video_id}
              config={config}
            />
            <Link
              href={`${videosPath}/${props.video.id}/edit`}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--ozer-accent)] text-sm font-semibold text-[var(--ozer-white)] shadow-sm transition-colors hover:bg-[var(--ozer-accent-hover)]"
            >
              Edit recording
            </Link>
            <p className="text-muted-foreground text-center text-xs">
              Cut dead air, add zooms, and tidy the transcript before sharing.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
