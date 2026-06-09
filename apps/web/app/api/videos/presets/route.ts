import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  configValuesFromRow,
  loadAccountPresets,
  loadAccountVideoSettings,
  savePreset,
} from '~/lib/videos/server/player-config-data';
import { requireVideoAccountAccess } from '~/lib/videos/server/videos-access';
import {
  playerConfigBodySchema,
} from '~/lib/videos/player-config-schema';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
});

function normalizeConfigInput(
  parsed: z.infer<typeof playerConfigBodySchema>,
) {
  return {
    name: parsed.name ?? 'Default',
    autoplay: parsed.autoplay,
    muted: parsed.muted,
    loop: parsed.loop,
    preload: parsed.preload,
    default_playback_speed: parsed.default_playback_speed,
    allowed_speeds: parsed.allowed_speeds ?? [0.5, 0.75, 1, 1.25, 1.5, 2],
    show_controls: parsed.show_controls,
    show_play_button: parsed.show_play_button,
    show_progress_bar: parsed.show_progress_bar,
    show_volume_control: parsed.show_volume_control,
    show_speed_control: parsed.show_speed_control,
    show_fullscreen_button: parsed.show_fullscreen_button,
    show_captions_button: parsed.show_captions_button,
    primary_color: parsed.primary_color,
    show_bunny_watermark: parsed.show_bunny_watermark,
    custom_logo_url:
      parsed.custom_logo_url === '' ? null : (parsed.custom_logo_url ?? null),
    logo_position: parsed.logo_position,
    enable_captions: parsed.enable_captions,
    default_caption_language: parsed.default_caption_language,
    responsive: parsed.responsive,
    aspect_ratio: parsed.aspect_ratio,
    max_width_px: parsed.max_width_px ?? null,
    allow_download: parsed.allow_download,
    token_auth_enabled: parsed.token_auth_enabled,
  };
}

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      accountId: request.nextUrl.searchParams.get('accountId'),
    });

    if (!parsed.success) {
      return jsonErr('VALIDATION', 'accountId required', 400);
    }

    const access = await requireVideoAccountAccess(parsed.data.accountId);
    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const [presets, settings] = await Promise.all([
      loadAccountPresets(access.client, parsed.data.accountId),
      loadAccountVideoSettings(access.client, parsed.data.accountId),
    ]);

    return jsonOk({
      presets: presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        values: configValuesFromRow(preset),
        isDefault:
          settings.default_player_preset_id === preset.id,
      })),
      defaultPresetId: settings.default_player_preset_id ?? null,
    });
  } catch (error) {
    console.error('[videos] presets GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load presets',
      500,
    );
  }
}

const createSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  config: playerConfigBodySchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = createSchema.safeParse(await request.json());
    if (!body.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, body.error.flatten());
    }

    const access = await requireVideoAccountAccess(body.data.accountId);
    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const saved = await savePreset(
      access.client,
      body.data.accountId,
      body.data.name,
      normalizeConfigInput(body.data.config),
    );

    return jsonOk({
      preset: {
        id: saved.id,
        name: saved.name,
        values: configValuesFromRow(saved),
      },
    });
  } catch (error) {
    console.error('[videos] presets POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to create preset',
      500,
    );
  }
}
