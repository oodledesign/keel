'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_PLAYER_CONFIG,
  PLAYBACK_SPEED_OPTIONS,
  type CaptionTrack,
  type LogoPosition,
  type PlayerPreload,
  type VideoPlayerConfigValues,
} from '~/lib/videos/player-config-types';

function ConfigRow(props: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium">{props.label}</Label>
        {props.description ? (
          <p className="text-muted-foreground mt-1 text-xs">{props.description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{props.children}</div>
    </div>
  );
}

function ColorField(props: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(props.value)
    ? props.value
    : DEFAULT_PLAYER_CONFIG.primary_color;

  return (
    <div className="flex items-center gap-2">
      <span
        className="h-8 w-8 shrink-0 rounded-md border border-white/10"
        style={{ backgroundColor: normalized }}
        aria-hidden
      />
      <input
        type="color"
        value={normalized}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
        aria-label="Pick colour"
      />
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        className="w-28 font-mono text-xs uppercase"
        placeholder="#6366F1"
      />
    </div>
  );
}

function LogoPositionControl(props: {
  value: LogoPosition;
  onChange: (value: LogoPosition) => void;
}) {
  const options: { value: LogoPosition; label: string }[] = [
    { value: 'top-left', label: 'TL' },
    { value: 'top-right', label: 'TR' },
    { value: 'bottom-left', label: 'BL' },
    { value: 'bottom-right', label: 'BR' },
  ];

  return (
    <div className="flex rounded-lg border border-white/10 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`rounded-md px-2.5 py-1 text-xs transition ${
            props.value === option.value
              ? 'keel-gradient-active text-white'
              : 'text-muted-foreground hover:text-white'
          }`}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PlayerConfigEditor(props: {
  config: VideoPlayerConfigValues;
  captions: CaptionTrack[];
  presets: Array<{ id: string; name: string; values: VideoPlayerConfigValues }>;
  saving: boolean;
  hidePresetsTab?: boolean;
  hideCaptionsTab?: boolean;
  onChange: (patch: Partial<VideoPlayerConfigValues>) => void;
  onSave: () => void;
  onBlurSave: () => void;
  onReset: () => void;
  onLoadPreset: (values: VideoPlayerConfigValues) => void;
  onSavePreset: (name: string) => Promise<void>;
  onUploadCaption: (file: File, srclang: string, label: string) => Promise<void>;
  uploadingCaption: boolean;
}) {
  const { config } = props;
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);

  const controlsDisabled = !config.show_controls;

  const updateControls = (showControls: boolean) => {
    if (!showControls) {
      props.onChange({
        show_controls: false,
        show_play_button: false,
        show_progress_bar: false,
        show_volume_control: false,
        show_speed_control: false,
        show_fullscreen_button: false,
        show_captions_button: false,
      });
      return;
    }

    props.onChange({
      show_controls: true,
      show_play_button: true,
      show_progress_bar: true,
      show_volume_control: true,
      show_speed_control: true,
      show_fullscreen_button: true,
      show_captions_button: true,
    });
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    setSavingPreset(true);
    try {
      await props.onSavePreset(name);
      setPresetName('');
      setPresetOpen(false);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleCaptionUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const srclang =
      config.default_caption_language || file.name.replace(/\.srt$/i, '') || 'en';
    const label = srclang.toUpperCase();

    await props.onUploadCaption(file, srclang, label);
    event.target.value = '';
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium">Player settings</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={props.onReset}
          >
            Reset to defaults
          </Button>
          <Button
            type="button"
            size="sm"
            className="keel-gradient-btn"
            disabled={props.saving}
            onClick={props.onSave}
          >
            {props.saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="playback" className="px-4 pb-4">
        <TabsList className="mb-2 mt-3 flex h-auto flex-wrap gap-1 bg-black/30 p-1">
          <TabsTrigger value="playback" className="text-xs">
            Playback
          </TabsTrigger>
          <TabsTrigger value="controls" className="text-xs">
            Controls
          </TabsTrigger>
          <TabsTrigger value="branding" className="text-xs">
            Branding
          </TabsTrigger>
          {!props.hideCaptionsTab ? (
            <TabsTrigger value="captions" className="text-xs">
              Captions
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="sharing" className="text-xs">
            Sharing
          </TabsTrigger>
          {!props.hidePresetsTab ? (
            <TabsTrigger value="presets" className="text-xs">
              Presets
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="playback" className="mt-0">
          <ConfigRow
            label="Autoplay"
            description={
              config.autoplay && !config.muted
                ? 'Requires muted to be enabled'
                : config.autoplay
                  ? 'Starts playback automatically when embedded'
                  : undefined
            }
          >
            <Switch
              checked={config.autoplay}
              onCheckedChange={(checked) => props.onChange({ autoplay: checked })}
            />
          </ConfigRow>
          <ConfigRow label="Muted">
            <Switch
              checked={config.muted}
              onCheckedChange={(checked) => props.onChange({ muted: checked })}
            />
          </ConfigRow>
          <ConfigRow label="Loop">
            <Switch
              checked={config.loop}
              onCheckedChange={(checked) => props.onChange({ loop: checked })}
            />
          </ConfigRow>
          <ConfigRow label="Preload">
            <Select
              value={config.preload}
              onValueChange={(value) =>
                props.onChange({ preload: value as PlayerPreload })
              }
            >
              <SelectTrigger className="w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="metadata">Metadata</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </ConfigRow>
          <ConfigRow label="Default speed">
            <Select
              value={String(config.default_playback_speed)}
              onValueChange={(value) =>
                props.onChange({ default_playback_speed: Number(value) })
              }
            >
              <SelectTrigger className="w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ConfigRow>
        </TabsContent>

        <TabsContent value="controls" className="mt-0">
          <ConfigRow label="Show player controls" description="Master toggle for all controls">
            <Switch
              checked={config.show_controls}
              onCheckedChange={updateControls}
            />
          </ConfigRow>
          <ConfigRow label="Play button">
            <Switch
              checked={config.show_play_button}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                props.onChange({ show_play_button: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Progress bar">
            <Switch
              checked={config.show_progress_bar}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                props.onChange({ show_progress_bar: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Volume">
            <Switch
              checked={config.show_volume_control}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                props.onChange({ show_volume_control: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Speed selector">
            <Switch
              checked={config.show_speed_control}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                props.onChange({ show_speed_control: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Fullscreen">
            <Switch
              checked={config.show_fullscreen_button}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                props.onChange({ show_fullscreen_button: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Captions button">
            <Switch
              checked={config.show_captions_button}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                props.onChange({ show_captions_button: checked })
              }
            />
          </ConfigRow>
        </TabsContent>

        <TabsContent value="branding" className="mt-0">
          <ConfigRow label="Primary colour">
            <ColorField
              value={config.primary_color}
              onChange={(value) => props.onChange({ primary_color: value })}
              onBlur={props.onBlurSave}
            />
          </ConfigRow>
          <ConfigRow label="Show Bunny watermark">
            <Switch
              checked={config.show_bunny_watermark}
              onCheckedChange={(checked) =>
                props.onChange({ show_bunny_watermark: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Custom logo URL">
            <Input
              value={config.custom_logo_url ?? ''}
              onChange={(event) =>
                props.onChange({
                  custom_logo_url: event.target.value || null,
                })
              }
              onBlur={props.onBlurSave}
              placeholder="https://…"
              className="w-56"
            />
          </ConfigRow>
          <ConfigRow label="Logo position">
            <LogoPositionControl
              value={config.logo_position}
              onChange={(value) => props.onChange({ logo_position: value })}
            />
          </ConfigRow>
        </TabsContent>

        {!props.hideCaptionsTab ? (
          <TabsContent value="captions" className="mt-0">
          <ConfigRow label="Enable captions">
            <Switch
              checked={config.enable_captions}
              onCheckedChange={(checked) =>
                props.onChange({ enable_captions: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Default language">
            <Select
              value={config.default_caption_language}
              onValueChange={(value) =>
                props.onChange({ default_caption_language: value })
              }
              disabled={!config.enable_captions}
            >
              <SelectTrigger className="w-[10rem]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {props.captions.length > 0 ? (
                  props.captions.map((track) => (
                    <SelectItem key={track.srclang} value={track.srclang}>
                      {track.label} ({track.srclang})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={config.default_caption_language}>
                    {config.default_caption_language}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </ConfigRow>
          <ConfigRow
            label="Upload SRT"
            description="Upload a caption file for this video"
          >
            <div>
              <input
                ref={captionInputRef}
                type="file"
                accept=".srt,text/plain"
                className="hidden"
                onChange={(event) => void handleCaptionUpload(event)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={props.uploadingCaption}
                onClick={() => captionInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {props.uploadingCaption ? 'Uploading…' : 'Upload SRT'}
              </Button>
            </div>
          </ConfigRow>
        </TabsContent>
        ) : null}

        <TabsContent value="sharing" className="mt-0">
          <ConfigRow label="Allow download">
            <Switch
              checked={config.allow_download}
              onCheckedChange={(checked) =>
                props.onChange({ allow_download: checked })
              }
            />
          </ConfigRow>
          <ConfigRow
            label="Token auth"
            description={
              <>
                Restrict embed access with signed tokens.{' '}
                <Link href="#" className="text-[var(--keel-teal)] underline-offset-2 hover:underline">
                  Manage tokens
                </Link>{' '}
                (coming soon)
              </>
            }
          >
            <Switch
              checked={config.token_auth_enabled}
              onCheckedChange={(checked) =>
                props.onChange({ token_auth_enabled: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Responsive">
            <Switch
              checked={config.responsive}
              onCheckedChange={(checked) =>
                props.onChange({ responsive: checked })
              }
            />
          </ConfigRow>
          <ConfigRow label="Aspect ratio">
            <Select
              value={config.aspect_ratio}
              onValueChange={(value) =>
                props.onChange({
                  aspect_ratio: value as VideoPlayerConfigValues['aspect_ratio'],
                })
              }
            >
              <SelectTrigger className="w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ConfigRow>
          <ConfigRow label="Max width (px)" description="Leave blank for unrestricted">
            <Input
              type="number"
              min={1}
              value={config.max_width_px ?? ''}
              onChange={(event) => {
                const raw = event.target.value.trim();
                props.onChange({
                  max_width_px: raw ? Number(raw) : null,
                });
              }}
              onBlur={props.onBlurSave}
              placeholder="Unrestricted"
              className="w-32"
            />
          </ConfigRow>
        </TabsContent>

        {!props.hidePresetsTab ? (
        <TabsContent value="presets" className="mt-0 space-y-4 py-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <Label className="text-xs">Load preset</Label>
              <Select
                onValueChange={(presetId) => {
                  const preset = props.presets.find((row) => row.id === presetId);
                  if (preset) props.onLoadPreset(preset.values);
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a preset…" />
                </SelectTrigger>
                <SelectContent>
                  {props.presets.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No presets saved yet
                    </SelectItem>
                  ) : (
                    props.presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPresetOpen(true)}
            >
              Save as preset
            </Button>
          </div>
        </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
          </DialogHeader>
          <Input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPresetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="keel-gradient-btn"
              disabled={!presetName.trim() || savingPreset}
              onClick={() => void handleSavePreset()}
            >
              {savingPreset ? 'Saving…' : 'Save preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
