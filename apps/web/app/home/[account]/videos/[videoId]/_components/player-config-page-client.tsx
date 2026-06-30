'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  DEFAULT_PLAYER_CONFIG,
  type CaptionTrack,
  type VideoPlayerConfigValues,
} from '~/lib/videos/player-config-types';

import { EmbedCode } from './embed-code';
import { PlayerConfigEditor } from './player-config-editor';
import { PlayerPreview } from './player-preview';
import { PublicSharePanel } from './public-share-panel';

function createPath(path: string, account: string, videoId: string) {
  return path.replace('[account]', account).replace('[videoId]', videoId);
}

export function PlayerConfigPageClient(props: {
  accountSlug: string;
  video: {
    id: string;
    title: string;
    bunny_library_id: string;
    bunny_video_id: string;
    status: string;
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
  cdnHostname: string;
}) {
  const [config, setConfig] = useState(props.initialConfig);
  const [presets, setPresets] = useState(props.initialPresets);
  const [captions, setCaptions] = useState(props.initialCaptions);
  const [saving, setSaving] = useState(false);
  const [uploadingCaption, setUploadingCaption] = useState(false);

  const persistConfig = useCallback(
    async (nextConfig: VideoPlayerConfigValues) => {
      setSaving(true);
      try {
        const res = await fetch(
          `/api/videos/${props.video.id}/player-config`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextConfig),
          },
        );
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

  const handleReset = () => {
    setConfig({ ...DEFAULT_PLAYER_CONFIG });
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
      <Link
        href={videosPath}
        className="text-muted-foreground inline-flex items-center gap-1.5 text-sm hover:text-[var(--workspace-shell-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to videos
      </Link>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-6">
          <PlayerConfigEditor
            config={config}
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
              videoTitle={props.video.title}
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
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <PlayerPreview
              libraryId={props.video.bunny_library_id}
              bunnyVideoId={props.video.bunny_video_id}
              config={config}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
