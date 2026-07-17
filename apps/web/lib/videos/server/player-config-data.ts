import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_PLAYER_CONFIG,
  type VideoPlayerConfigRow,
  type VideoPlayerConfigValues,
} from '../player-config-types';
import { type VideoSettings, parseVideoSettings } from '../video-settings';

export function configValuesFromRow(
  row: VideoPlayerConfigRow | null,
): VideoPlayerConfigValues {
  if (!row) return { ...DEFAULT_PLAYER_CONFIG };

  return {
    name: row.name,
    autoplay: row.autoplay,
    muted: row.muted,
    loop: row.loop,
    preload: row.preload,
    default_playback_speed: Number(row.default_playback_speed),
    allowed_speeds: row.allowed_speeds.map(Number),
    show_controls: row.show_controls,
    show_play_button: row.show_play_button,
    show_progress_bar: row.show_progress_bar,
    show_volume_control: row.show_volume_control,
    show_speed_control: row.show_speed_control,
    show_fullscreen_button: row.show_fullscreen_button,
    show_captions_button: row.show_captions_button,
    primary_color: row.primary_color,
    show_bunny_watermark: row.show_bunny_watermark,
    custom_logo_url: row.custom_logo_url,
    logo_position: row.logo_position,
    enable_captions: row.enable_captions,
    default_caption_language: row.default_caption_language,
    responsive: row.responsive,
    aspect_ratio: row.aspect_ratio,
    max_width_px: row.max_width_px,
    allow_download: row.allow_download,
    token_auth_enabled: row.token_auth_enabled,
  };
}

export async function loadPresetById(client: SupabaseClient, presetId: string) {
  const { data, error } = await client
    .from('video_player_configs')
    .select('*')
    .eq('id', presetId)
    .eq('is_preset', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as VideoPlayerConfigRow | null;
}

export async function updatePreset(
  client: SupabaseClient,
  presetId: string,
  values: VideoPlayerConfigValues,
) {
  const { name, ...configFields } = values;
  const { data, error } = await client
    .from('video_player_configs')
    .update({
      name,
      ...configFields,
    })
    .eq('id', presetId)
    .eq('is_preset', true)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as VideoPlayerConfigRow;
}

export async function deletePreset(client: SupabaseClient, presetId: string) {
  const { error } = await client
    .from('video_player_configs')
    .delete()
    .eq('id', presetId)
    .eq('is_preset', true);

  if (error) throw new Error(error.message);
}

export async function duplicatePreset(
  client: SupabaseClient,
  accountId: string,
  presetId: string,
) {
  const source = await loadPresetById(client, presetId);
  if (!source) {
    throw new Error('Preset not found');
  }

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = source;

  const { data, error } = await client
    .from('video_player_configs')
    .insert({
      ...rest,
      account_id: accountId,
      video_id: null,
      is_preset: true,
      name: `${source.name} (copy)`,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as VideoPlayerConfigRow;
}

export async function loadAccountVideoSettings(
  client: SupabaseClient,
  accountId: string,
): Promise<VideoSettings> {
  const { data, error } = await client
    .from('accounts')
    .select('video_settings')
    .eq('id', accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parseVideoSettings(data?.video_settings);
}

export async function updateAccountVideoSettings(
  client: SupabaseClient,
  accountId: string,
  patch: VideoSettings,
) {
  const current = await loadAccountVideoSettings(client, accountId);
  const next = { ...current, ...patch };

  const { error } = await client
    .from('accounts')
    .update({ video_settings: next })
    .eq('id', accountId);

  if (error) throw new Error(error.message);
  return next;
}

export async function resolveEffectivePlayerConfig(
  client: SupabaseClient,
  accountId: string,
  videoId: string,
): Promise<{
  config: VideoPlayerConfigValues;
  source: 'video' | 'account_preset' | 'default';
  configRow: VideoPlayerConfigRow | null;
}> {
  const videoConfig = await loadVideoPlayerConfig(client, videoId);
  if (videoConfig) {
    return {
      config: configValuesFromRow(videoConfig),
      source: 'video',
      configRow: videoConfig,
    };
  }

  const settings = await loadAccountVideoSettings(client, accountId);
  if (settings.default_player_preset_id) {
    const preset = await loadPresetById(
      client,
      settings.default_player_preset_id,
    );
    if (preset && preset.account_id === accountId) {
      return {
        config: configValuesFromRow(preset),
        source: 'account_preset',
        configRow: null,
      };
    }
  }

  return {
    config: { ...DEFAULT_PLAYER_CONFIG },
    source: 'default',
    configRow: null,
  };
}

export async function loadVideoPlayerConfig(
  client: SupabaseClient,
  videoId: string,
) {
  const { data, error } = await client
    .from('video_player_configs')
    .select('*')
    .eq('video_id', videoId)
    .eq('is_preset', false)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as VideoPlayerConfigRow | null;
}

export async function loadAccountPresets(
  client: SupabaseClient,
  accountId: string,
) {
  const { data, error } = await client
    .from('video_player_configs')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_preset', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as VideoPlayerConfigRow[];
}

export async function upsertVideoPlayerConfig(
  client: SupabaseClient,
  accountId: string,
  videoId: string,
  values: VideoPlayerConfigValues,
) {
  const existing = await loadVideoPlayerConfig(client, videoId);
  const payload = {
    account_id: accountId,
    video_id: videoId,
    is_preset: false,
    ...values,
  };

  if (existing) {
    const { data, error } = await client
      .from('video_player_configs')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as VideoPlayerConfigRow;
  }

  const { data, error } = await client
    .from('video_player_configs')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as VideoPlayerConfigRow;
}

export async function savePreset(
  client: SupabaseClient,
  accountId: string,
  name: string,
  values: VideoPlayerConfigValues,
) {
  const { name: _configName, ...configFields } = values;

  const { data, error } = await client
    .from('video_player_configs')
    .insert({
      account_id: accountId,
      video_id: null,
      is_preset: true,
      name,
      ...configFields,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as VideoPlayerConfigRow;
}
