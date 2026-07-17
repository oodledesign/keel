import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { playerConfigBodySchema } from '~/lib/videos/player-config-schema';
import {
  configValuesFromRow,
  deletePreset,
  duplicatePreset,
  loadPresetById,
  updateAccountVideoSettings,
  updatePreset,
} from '~/lib/videos/server/player-config-data';
import { requireVideoAccountAccess } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

async function requirePresetAccess(presetId: string) {
  const client = getSupabaseServerClient();
  const preset = await loadPresetById(client, presetId);

  if (!preset) {
    return { error: 'NOT_FOUND' as const, client, preset: null };
  }

  const access = await requireVideoAccountAccess(preset.account_id as string);
  if (access.error) {
    return { error: access.error, client: access.client, preset: null };
  }

  return { error: null, client: access.client, preset };
}

function normalizeConfigInput(parsed: z.infer<typeof playerConfigBodySchema>) {
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

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { presetId } = await context.params;
    const result = await requirePresetAccess(presetId);

    if (result.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (result.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Preset not found', 404);
    }
    if (result.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const preset = result.preset!;
    return jsonOk({
      preset: {
        id: preset.id,
        name: preset.name,
        values: configValuesFromRow(preset),
      },
    });
  } catch (error) {
    console.error('[videos] preset GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load preset',
      500,
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { presetId } = await context.params;
    const result = await requirePresetAccess(presetId);

    if (result.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (result.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Preset not found', 404);
    }
    if (result.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const body = await request.json();
    const actionSchema = z.object({ action: z.literal('set-default') });

    const actionParsed = actionSchema.safeParse(body);
    if (actionParsed.success) {
      await updateAccountVideoSettings(
        result.client,
        result.preset!.account_id as string,
        { default_player_preset_id: presetId },
      );
      return jsonOk({ defaultPresetId: presetId });
    }

    const parsed = playerConfigBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr(
        'VALIDATION',
        'Invalid config',
        400,
        parsed.error.flatten(),
      );
    }

    const saved = await updatePreset(
      result.client,
      presetId,
      normalizeConfigInput(parsed.data),
    );

    return jsonOk({
      preset: {
        id: saved.id,
        name: saved.name,
        values: configValuesFromRow(saved),
      },
    });
  } catch (error) {
    console.error('[videos] preset PATCH', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to update preset',
      500,
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { presetId } = await context.params;
    const result = await requirePresetAccess(presetId);

    if (result.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (result.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Preset not found', 404);
    }
    if (result.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    await deletePreset(result.client, presetId);

    const accountId = result.preset!.account_id as string;
    const { loadAccountVideoSettings } =
      await import('~/lib/videos/server/player-config-data');
    const settings = await loadAccountVideoSettings(result.client, accountId);
    if (settings.default_player_preset_id === presetId) {
      await updateAccountVideoSettings(result.client, accountId, {
        default_player_preset_id: null,
      });
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    console.error('[videos] preset DELETE', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to delete preset',
      500,
    );
  }
}

const duplicateSchema = z.object({ action: z.literal('duplicate') });

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { presetId } = await context.params;
    const result = await requirePresetAccess(presetId);

    if (result.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (result.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Preset not found', 404);
    }
    if (result.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const body = duplicateSchema.safeParse(await request.json());
    if (!body.success) {
      return jsonErr('VALIDATION', 'Invalid action', 400);
    }

    const copy = await duplicatePreset(
      result.client,
      result.preset!.account_id as string,
      presetId,
    );

    return jsonOk({
      preset: {
        id: copy.id,
        name: copy.name,
        values: configValuesFromRow(copy),
      },
    });
  } catch (error) {
    console.error('[videos] preset POST duplicate', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to duplicate preset',
      500,
    );
  }
}
