import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { checkIgApiAccess } from '~/lib/instagram-autoreply/api-access';
import { validateAssetUpload } from '~/lib/instagram-autoreply/audio/detect-format';
import {
  IG_ASSETS_BUCKET,
  incomingAssetPath,
  processIgAssetUpload,
} from '~/lib/instagram-autoreply/audio/process-asset-upload';
import { transcodeToM4a } from '~/lib/instagram-autoreply/audio/transcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const paramsSchema = z.object({ assetId: z.string().uuid() });

const ASSET_COLUMNS =
  'id, label, kind, source, mime_type, size_bytes, duration_ms, waveform, transcode_status, transcode_error, created_at';

/** Phase 2: validate the uploaded bytes, store the original and transcode audio to m4a. */
export const POST = enhanceRouteHandler(
  async ({ params, user }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid asset' }, { status: 400 });
    }
    const { assetId } = parsed.data;

    const client = getSupabaseServerClient();
    const { data: asset } = await client
      .from('ig_automation_assets')
      .select('id, account_id, kind, transcode_status')
      .eq('id', assetId)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const access = await checkIgApiAccess(client, {
      accountId: asset.account_id,
      userId: user.id,
      requireManage: true,
    });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (asset.transcode_status === 'ready') {
      return NextResponse.json({ error: 'Already processed' }, { status: 409 });
    }

    const admin = getSupabaseServerAdminClient();
    const incoming = incomingAssetPath(asset.account_id, asset.id);
    const { data: blob, error: downloadError } = await admin.storage
      .from(IG_ASSETS_BUCKET)
      .download(incoming);

    if (downloadError || !blob) {
      return NextResponse.json(
        { error: 'Upload not found. Please try again.' },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    const kind = asset.kind as 'audio' | 'image' | 'video' | 'pdf';

    const markFailed = async (message: string) => {
      await admin
        .from('ig_automation_assets')
        .update({ transcode_status: 'failed', transcode_error: message })
        .eq('id', asset.id);
    };

    const validation = validateAssetUpload({
      kind,
      sizeBytes: bytes.length,
      head: bytes.subarray(0, 64),
    });

    if (!validation.ok) {
      await markFailed(validation.error);
      await admin.storage.from(IG_ASSETS_BUCKET).remove([incoming]);
      return NextResponse.json({ error: validation.error }, { status: 415 });
    }

    const result = await processIgAssetUpload(
      {
        upload: async (path, body, contentType) => {
          const { error } = await admin.storage
            .from(IG_ASSETS_BUCKET)
            .upload(path, body, { contentType, upsert: true });
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
        accountId: asset.account_id,
        assetId: asset.id,
        kind,
        format: validation.format,
        bytes,
      },
    );

    await admin.storage.from(IG_ASSETS_BUCKET).remove([incoming]);

    if (result.status === 'failed') {
      console.warn('[ig-assets] processing failed', { assetId, kind });
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const { data: row } = await admin
      .from('ig_automation_assets')
      .select(ASSET_COLUMNS)
      .eq('id', asset.id)
      .single();

    return NextResponse.json({ asset: row });
  },
  { auth: true },
);
