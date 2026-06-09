'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  DEFAULT_PLAYER_CONFIG,
  type VideoPlayerConfigValues,
} from '~/lib/videos/player-config-types';

import { PlayerConfigEditor } from '../../../[videoId]/_components/player-config-editor';

export function PresetEditorClient(props: {
  accountSlug: string;
  presetId: string;
  initialConfig: VideoPlayerConfigValues;
}) {
  const router = useRouter();
  const [config, setConfig] = useState(props.initialConfig);
  const [saving, setSaving] = useState(false);

  const presetsPath = pathsConfig.app.accountVideoPresets.replace(
    '[account]',
    props.accountSlug,
  );

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/presets/${props.presetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Save failed');
      setConfig(json.data.preset.values);
      toast.success('Preset saved');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-4 lg:px-0">
      <Link
        href={presetsPath}
        className="text-muted-foreground inline-flex items-center gap-1.5 text-sm hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to presets
      </Link>

      <PlayerConfigEditor
        config={config}
        captions={[]}
        presets={[]}
        saving={saving}
        hidePresetsTab
        hideCaptionsTab
        onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
        onSave={() => void save()}
        onBlurSave={() => void save()}
        onReset={() => {
          setConfig({ ...DEFAULT_PLAYER_CONFIG, name: config.name });
          toast.message('Reset to defaults — save to apply');
        }}
        onLoadPreset={() => undefined}
        onSavePreset={async () => undefined}
        onUploadCaption={async () => undefined}
        uploadingCaption={false}
      />
    </div>
  );
}
