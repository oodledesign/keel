'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

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
import type { VideoSettingsPublic } from '~/lib/videos/video-settings';

import { saveVideoModuleSettings } from '../_lib/server/video-settings-actions';

export function VideoSettingsForm(props: {
  accountId: string;
  accountSlug: string;
  initialSettings: VideoSettingsPublic;
  presets: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const settingsHref = pathsConfig.app.accountSettings.replace(
    '[account]',
    props.accountSlug,
  );
  const videosHref = pathsConfig.app.accountVideos.replace(
    '[account]',
    props.accountSlug,
  );

  const [libraryId, setLibraryId] = useState(
    props.initialSettings.bunny_library_id ?? '',
  );
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [defaultPresetId, setDefaultPresetId] = useState(
    props.initialSettings.default_player_preset_id ?? '',
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveVideoModuleSettings({
        accountId: props.accountId,
        bunny_library_id: libraryId.trim() || null,
        bunny_api_key: apiKey.trim() || null,
        clear_bunny_api_key: clearApiKey || undefined,
        default_player_preset_id: defaultPresetId || null,
      });
      toast.success('Video settings saved');
      setApiKey('');
      setClearApiKey(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 lg:px-0">
      <Link
        href={settingsHref}
        className="text-muted-foreground text-sm hover:text-white"
      >
        ← Workspace settings
      </Link>

      <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <div className="mb-6">
          <h2 className="text-base font-semibold">Video hosting</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure Bunny Stream credentials and default player behaviour for
            this workspace.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <Label htmlFor="bunny-library-id">Bunny Library ID override</Label>
            <Input
              id="bunny-library-id"
              value={libraryId}
              onChange={(event) => setLibraryId(event.target.value)}
              placeholder="Uses platform default when empty"
              disabled={!props.canEdit}
              className="mt-1.5"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Per-workspace library ID for white-label or agency-owned Bunny
              accounts.
            </p>
          </div>

          <div>
            <Label htmlFor="bunny-api-key">Bunny API Key override</Label>
            <Input
              id="bunny-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                props.initialSettings.has_bunny_api_key
                  ? '••••••••••••••••'
                  : 'Uses platform default when empty'
              }
              disabled={!props.canEdit}
              className="mt-1.5"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Stored encrypted at rest using TOKEN_ENCRYPTION_KEY. Leave blank
              to keep the current key; use clear below to remove an override.
            </p>
            {props.initialSettings.has_bunny_api_key && props.canEdit ? (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={clearApiKey}
                  onChange={(event) => setClearApiKey(event.target.checked)}
                />
                Clear stored API key override
              </label>
            ) : null}
          </div>

          <div>
            <Label>Default player preset</Label>
            <Select
              value={defaultPresetId || '__none'}
              onValueChange={(value) =>
                setDefaultPresetId(value === '__none' ? '' : value)
              }
              disabled={!props.canEdit}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="System defaults" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">System defaults</SelectItem>
                {props.presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground mt-1 text-xs">
              Used when a video has no saved player config.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {props.canEdit ? (
            <Button
              type="button"
              className="keel-gradient-btn"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save settings'
              )}
            </Button>
          ) : null}
          <Button type="button" variant="outline" asChild className="gap-1.5">
            <Link href={videosHref}>
              <ExternalLink className="h-4 w-4" />
              Open video module
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
