'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Copy,
  Loader2,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  DEFAULT_PLAYER_CONFIG,
  type VideoPlayerConfigValues,
} from '~/lib/videos/player-config-types';

import { PlayerConfigEditor } from '../../[videoId]/_components/player-config-editor';

export type PresetListItem = {
  id: string;
  name: string;
  values: VideoPlayerConfigValues;
  isDefault: boolean;
};

function PresetSummary(props: { values: VideoPlayerConfigValues }) {
  const { values } = props;

  return (
    <div className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-xs">
      <span className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5">
        Autoplay: {values.autoplay ? 'On' : 'Off'}
      </span>
      <span className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5">
        Loop: {values.loop ? 'On' : 'Off'}
      </span>
      <span className="inline-flex items-center gap-1 rounded bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5">
        <span
          className="h-3 w-3 rounded-sm border border-[color:var(--workspace-shell-border)]"
          style={{ backgroundColor: values.primary_color }}
        />
        {values.primary_color}
      </span>
      <span className="rounded bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5">
        Controls: {values.show_controls ? 'On' : 'Off'}
      </span>
    </div>
  );
}

export function PresetsLibraryClient(props: {
  accountId: string;
  accountSlug: string;
  initialPresets: PresetListItem[];
}) {
  const router = useRouter();
  const [presets, setPresets] = useState(props.initialPresets);
  const [createOpen, setCreateOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [draftConfig, setDraftConfig] = useState<VideoPlayerConfigValues>({
    ...DEFAULT_PLAYER_CONFIG,
    name: 'New preset',
  });
  const [creating, setCreating] = useState(false);

  const presetEditPath = (presetId: string) =>
    pathsConfig.app.accountVideoPresetDetail
      .replace('[account]', props.accountSlug)
      .replace('[presetId]', presetId);

  const refreshPresets = async () => {
    const res = await fetch(
      `/api/videos/presets?accountId=${encodeURIComponent(props.accountId)}`,
    );
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? 'Failed to refresh');
    setPresets(json.data.presets);
  };

  const duplicatePreset = async (presetId: string) => {
    try {
      const res = await fetch(`/api/videos/presets/${presetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast.success('Preset duplicated');
      await refreshPresets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deletePreset = async (preset: PresetListItem) => {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;

    try {
      const res = await fetch(`/api/videos/presets/${preset.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast.success('Preset deleted');
      await refreshPresets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const setDefault = async (presetId: string) => {
    try {
      const res = await fetch(`/api/videos/presets/${presetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-default' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast.success('Account default preset updated');
      await refreshPresets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const createPreset = async () => {
    const name = presetName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch('/api/videos/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          name,
          config: { ...draftConfig, name },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast.success('Preset created');
      setCreateOpen(false);
      setPresetName('');
      setDraftConfig({ ...DEFAULT_PLAYER_CONFIG, name: 'New preset' });
      router.refresh();
      await refreshPresets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
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
          className="text-muted-foreground text-sm hover:text-[var(--workspace-shell-text)]"
        >
          ← Back to videos
        </Link>
        <Button
          type="button"
          className="ozer-gradient-btn gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New preset
        </Button>
      </div>

      {presets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-black/10 px-6 py-16 text-center">
          <p className="text-lg font-medium">No presets yet</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Save reusable player configurations for consistent embeds across
            videos.
          </p>
          <Button
            type="button"
            className="ozer-gradient-btn mt-6 gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New preset
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => (
            <article
              key={preset.id}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium">{preset.name}</h3>
                    {preset.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ozer-accent)]">
                        <Star className="h-3 w-3" />
                        Default
                      </span>
                    ) : null}
                  </div>
                  <PresetSummary values={preset.values} />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={presetEditPath(preset.id)}>Edit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void duplicatePreset(preset.id)}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Duplicate
                    </DropdownMenuItem>
                    {!preset.isDefault ? (
                      <DropdownMenuItem onClick={() => void setDefault(preset.id)}>
                        <Star className="mr-2 h-3.5 w-3.5" />
                        Set as account default
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={() => void deletePreset(preset)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New preset</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Marketing embed"
                className="mt-1.5"
              />
            </div>

            <PlayerConfigEditor
              config={draftConfig}
              captions={[]}
              presets={[]}
              saving={creating}
              hidePresetsTab
              hideCaptionsTab
              onChange={(patch: Partial<VideoPlayerConfigValues>) =>
                setDraftConfig((current) => ({ ...current, ...patch }))
              }
              onSave={() => void createPreset()}
              onBlurSave={() => undefined}
              onReset={() =>
                setDraftConfig({ ...DEFAULT_PLAYER_CONFIG, name: 'New preset' })
              }
              onLoadPreset={() => undefined}
              onSavePreset={async () => undefined}
              onUploadCaption={async () => undefined}
              uploadingCaption={false}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="ozer-gradient-btn"
              disabled={!presetName.trim() || creating}
              onClick={() => void createPreset()}
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save preset'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
