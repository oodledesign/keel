import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  IG_TTS_MODEL_ID,
  estimateTtsCost,
} from '~/lib/billing/media-unit-pricing';
import { checkIgApiAccess } from '~/lib/instagram-autoreply/api-access';
import {
  IG_ASSET_MAX_BYTES,
  validateAssetUpload,
} from '~/lib/instagram-autoreply/audio/detect-format';
import {
  IG_ASSETS_BUCKET,
  originalAssetPath,
  processIgAssetUpload,
} from '~/lib/instagram-autoreply/audio/process-asset-upload';
import { transcodeToM4a } from '~/lib/instagram-autoreply/audio/transcode';
import {
  IG_TTS_MAX_CHARS,
  IG_TTS_PRESET_VOICES,
} from '~/lib/instagram-autoreply/audio/tts-voices';
import {
  debitMediaCredits,
  getMediaBalance,
  isInsufficientMediaCreditsError,
} from '~/lib/media-credits/ledger';
import { FalProviderError, falRun } from '~/lib/media-generation/providers/fal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z
  .object({
    accountId: z.string().uuid(),
    label: z.string().trim().min(1).max(120),
    text: z.string().trim().min(1).max(IG_TTS_MAX_CHARS),
    voice: z.string().trim().min(1).max(64),
    customVoice: z.boolean().default(false),
    voiceCloneConsent: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (
      !value.customVoice &&
      !IG_TTS_PRESET_VOICES.some((v) => v.id === value.voice)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['voice'],
        message: 'Choose a voice',
      });
    }
    if (value.customVoice && !/^[A-Za-z0-9]{10,40}$/.test(value.voice)) {
      ctx.addIssue({
        code: 'custom',
        path: ['voice'],
        message: 'Enter a valid voice ID',
      });
    }
    if (value.customVoice && !value.voiceCloneConsent) {
      ctx.addIssue({
        code: 'custom',
        path: ['voiceCloneConsent'],
        message: 'Confirm you have consent to use this voice',
      });
    }
  });

const ASSET_COLUMNS =
  'id, label, kind, source, mime_type, size_bytes, duration_ms, waveform, transcode_status, transcode_error, created_at';

type FalTtsResponse = { audio?: { url?: string } };

/**
 * Generate a voice note with text-to-speech, then run it through the normal
 * audio pipeline (validate, store, transcode to m4a). Media credits are only
 * debited once the voice note is ready.
 */
export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    const client = getSupabaseServerClient();
    const access = await checkIgApiAccess(client, {
      accountId: body.accountId,
      userId: user.id,
      requireManage: true,
    });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const units = estimateTtsCost(body.text.length);
    const balance = await getMediaBalance(body.accountId);
    if (balance < units) {
      return NextResponse.json(
        {
          error: `This voice note needs ${units} media credits and you have ${balance}. Top up media credits to continue.`,
          code: 'INSUFFICIENT_MEDIA_CREDITS',
        },
        { status: 402 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const { data: asset, error: insertError } = await admin
      .from('ig_automation_assets')
      .insert({
        account_id: body.accountId,
        label: body.label,
        kind: 'audio',
        source: 'tts',
        transcode_status: 'processing',
        created_by: user.id,
        voice_clone_consent_at: body.customVoice
          ? new Date().toISOString()
          : null,
        consenting_user_id: body.customVoice ? user.id : null,
      })
      .select('id')
      .single();
    if (insertError || !asset) {
      return NextResponse.json(
        { error: 'Could not create the voice note' },
        { status: 500 },
      );
    }

    const fail = async (message: string, status: number) => {
      await admin
        .from('ig_automation_assets')
        .update({ transcode_status: 'failed', transcode_error: message })
        .eq('id', asset.id);
      return NextResponse.json({ error: message }, { status });
    };

    let bytes: Buffer;
    try {
      const response = await falRun<FalTtsResponse>(IG_TTS_MODEL_ID, {
        text: body.text,
        voice: body.voice,
        apply_text_normalization: 'auto',
      });
      const audioUrl = response.audio?.url;
      if (!audioUrl)
        throw new FalProviderError(502, 'No audio in TTS response');

      const download = await fetch(audioUrl);
      if (!download.ok)
        throw new FalProviderError(download.status, 'Audio download failed');
      bytes = Buffer.from(await download.arrayBuffer());
    } catch (error) {
      console.warn('[ig-tts] generation failed', {
        assetId: asset.id,
        status: error instanceof FalProviderError ? error.status : null,
      });
      return fail(
        'Voice generation failed. Try again or pick another voice.',
        502,
      );
    }

    if (bytes.length > IG_ASSET_MAX_BYTES.audio) {
      return fail('The generated audio is too large. Try shorter text.', 413);
    }

    const validation = validateAssetUpload({
      kind: 'audio',
      sizeBytes: bytes.length,
      head: bytes.subarray(0, 64),
    });
    if (!validation.ok) return fail(validation.error, 422);

    const result = await processIgAssetUpload(
      {
        upload: async (path, data, contentType) => {
          const { error } = await admin.storage
            .from(IG_ASSETS_BUCKET)
            .upload(path, data, { contentType, upsert: true });
          if (error) throw new Error('Storage upload failed');
        },
        updateAsset: async (patch) => {
          const { error } = await admin
            .from('ig_automation_assets')
            .update(patch)
            .eq('id', asset.id);
          if (error) throw new Error('Could not update the asset');
        },
        transcode: (input, ext) => transcodeToM4a(input, ext),
      },
      {
        accountId: body.accountId,
        assetId: asset.id,
        kind: 'audio',
        format: validation.format,
        bytes,
      },
    );

    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    try {
      await debitMediaCredits(body.accountId, units, null);
    } catch (error) {
      if (isInsufficientMediaCreditsError(error)) {
        await admin.storage
          .from(IG_ASSETS_BUCKET)
          .remove([
            originalAssetPath(body.accountId, asset.id, validation.format),
            result.deliveryPath,
          ]);
        await admin.from('ig_automation_assets').delete().eq('id', asset.id);
        return NextResponse.json(
          {
            error:
              'You ran out of media credits while generating. Top up and try again.',
            code: 'INSUFFICIENT_MEDIA_CREDITS',
          },
          { status: 402 },
        );
      }
      throw error;
    }

    await admin
      .from('ig_automation_assets')
      .update({ media_credits_charged: units })
      .eq('id', asset.id);

    const { data: row } = await admin
      .from('ig_automation_assets')
      .select(ASSET_COLUMNS)
      .eq('id', asset.id)
      .single();

    return NextResponse.json({ asset: row, mediaCreditsCharged: units });
  },
  { auth: true, schema: bodySchema },
);
