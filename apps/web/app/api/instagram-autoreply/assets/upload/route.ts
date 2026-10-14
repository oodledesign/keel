import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { checkIgApiAccess } from '~/lib/instagram-autoreply/api-access';
import { IG_ASSET_MAX_BYTES } from '~/lib/instagram-autoreply/audio/detect-format';
import {
  IG_ASSETS_BUCKET,
  incomingAssetPath,
} from '~/lib/instagram-autoreply/audio/process-asset-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(['audio', 'image', 'video', 'pdf']),
  source: z.enum(['upload', 'recording']).default('upload'),
  label: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  waveform: z.array(z.number().min(0).max(1)).max(256).nullable().optional(),
});

/**
 * Phase 1 of an asset upload: create the asset row and hand back a one-off
 * signed upload URL so the browser uploads straight to Storage (avoids the
 * serverless request body limit). Phase 2 is POST /assets/[assetId]/process.
 */
export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    const { accountId, kind, source, label, sizeBytes, waveform } = body;

    if (sizeBytes > IG_ASSET_MAX_BYTES[kind]) {
      return NextResponse.json(
        {
          error: `The file is too large. The maximum is ${Math.round(IG_ASSET_MAX_BYTES[kind] / (1024 * 1024))} MB.`,
        },
        { status: 413 },
      );
    }

    const client = getSupabaseServerClient();
    const access = await checkIgApiAccess(client, {
      accountId,
      userId: user.id,
      requireManage: true,
    });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const { data: asset, error: insertError } = await client
      .from('ig_automation_assets')
      .insert({
        account_id: accountId,
        label,
        kind,
        source,
        waveform: waveform?.map((n) => Math.round(n * 1000) / 1000) ?? null,
        transcode_status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError || !asset) {
      return NextResponse.json(
        { error: 'Could not create the asset' },
        { status: 500 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const path = incomingAssetPath(accountId, asset.id);
    const { data: signed, error: signError } = await admin.storage
      .from(IG_ASSETS_BUCKET)
      .createSignedUploadUrl(path);

    if (signError || !signed) {
      await admin.from('ig_automation_assets').delete().eq('id', asset.id);
      return NextResponse.json(
        { error: 'Could not prepare the upload' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      assetId: asset.id,
      bucket: IG_ASSETS_BUCKET,
      path: signed.path,
      token: signed.token,
    });
  },
  { auth: true, schema: bodySchema },
);
