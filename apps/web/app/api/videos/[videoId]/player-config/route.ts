import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { createBunnyStreamClient } from '@kit/bunny';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  configValuesFromRow,
  loadAccountPresets,
  resolveEffectivePlayerConfig,
  savePreset,
  upsertVideoPlayerConfig,
} from '~/lib/videos/server/player-config-data';
import { requireVideoById } from '~/lib/videos/server/videos-access';
import { getBunnyCdnHostname } from '~/lib/videos/server/videos-data';
import {
  playerConfigBodySchema,
  savePresetBodySchema,
} from '~/lib/videos/player-config-schema';
import { buildIframeEmbedCode } from '~/lib/videos/embed';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

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
    custom_logo_url: parsed.custom_logo_url === '' ? null : (parsed.custom_logo_url ?? null),
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

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { videoId } = await context.params;
    const access = await requireVideoById(videoId);

    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Video not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const video = access.video!;
    const accountId = video.account_id as string;

    const [resolved, presets] = await Promise.all([
      resolveEffectivePlayerConfig(access.client, accountId, videoId),
      loadAccountPresets(access.client, accountId),
    ]);

    const { config, source, configRow } = resolved;
    const bunny = createBunnyStreamClient();
    const captions = await bunny.listCaptions(
      String(video.bunny_library_id),
      String(video.bunny_video_id),
    );

    return jsonOk({
      config,
      configSource: source,
      configId: configRow?.id ?? null,
      presets: presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        values: configValuesFromRow(preset),
      })),
      captions,
      video: {
        id: video.id,
        title: video.title,
        bunny_library_id: video.bunny_library_id,
        bunny_video_id: video.bunny_video_id,
      },
      cdnHostname: getBunnyCdnHostname(),
      embedIframe: buildIframeEmbedCode(
        String(video.bunny_library_id),
        String(video.bunny_video_id),
        config,
      ),
    });
  } catch (error) {
    console.error('[videos] player-config GET', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to load player config',
      500,
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { videoId } = await context.params;
    const access = await requireVideoById(videoId);

    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Video not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const body = await request.json();
    const presetParsed = savePresetBodySchema.safeParse(body);

    if (presetParsed.success) {
      const saved = await savePreset(
        access.client,
        access.video!.account_id as string,
        presetParsed.data.name,
        normalizeConfigInput(presetParsed.data.config),
      );
      return jsonOk({
        preset: {
          id: saved.id,
          name: saved.name,
          values: configValuesFromRow(saved),
        },
      });
    }

    const parsed = playerConfigBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid config', 400, parsed.error.flatten());
    }

    const saved = await upsertVideoPlayerConfig(
      access.client,
      access.video!.account_id as string,
      videoId,
      normalizeConfigInput(parsed.data),
    );

    return jsonOk({
      config: configValuesFromRow(saved),
      configId: saved.id,
    });
  } catch (error) {
    console.error('[videos] player-config PUT', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to save player config',
      500,
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PUT(request, context);
}
