import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { checkIgApiAccess } from '~/lib/instagram-autoreply/api-access';
import { createAssetPreviewUrl } from '~/lib/instagram-autoreply/audio/get-delivery-url';
import {
  IG_ASSETS_BUCKET,
  incomingAssetPath,
} from '~/lib/instagram-autoreply/audio/process-asset-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ assetId: z.string().uuid() });

async function loadAsset(assetId: string) {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('ig_automation_assets')
    .select('id, account_id, delivery_path, original_path, transcode_status')
    .eq('id', assetId)
    .maybeSingle();
  return { client, asset: data };
}

/** Short-lived preview URL for in-app playback. Returned to the browser only; never stored. */
export const GET = enhanceRouteHandler(
  async ({ params, user }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid asset' }, { status: 400 });
    }

    const { client, asset } = await loadAsset(parsed.data.assetId);
    if (!asset?.delivery_path) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const access = await checkIgApiAccess(client, {
      accountId: asset.account_id,
      userId: user.id,
      requireManage: false,
    });
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const url = await createAssetPreviewUrl(
      getSupabaseServerAdminClient(),
      asset.delivery_path,
    );

    return NextResponse.json(
      { url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  },
  { auth: true },
);

const patchSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const PATCH = enhanceRouteHandler(
  async ({ params, body, user }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid asset' }, { status: 400 });
    }

    const { client, asset } = await loadAsset(parsed.data.assetId);
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

    const { error } = await client
      .from('ig_automation_assets')
      .update({ label: body.label })
      .eq('id', asset.id);

    if (error) {
      return NextResponse.json(
        { error: 'Could not rename the asset' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  },
  { auth: true, schema: patchSchema },
);

export const DELETE = enhanceRouteHandler(
  async ({ params, user }) => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid asset' }, { status: 400 });
    }

    const { client, asset } = await loadAsset(parsed.data.assetId);
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

    const { count } = await client
      .from('ig_automation_steps')
      .select('id', { count: 'exact', head: true })
      .eq('asset_id', asset.id);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            'This file is used in an automation. Remove it from those steps first.',
        },
        { status: 409 },
      );
    }

    const paths = [
      asset.original_path,
      asset.delivery_path,
      incomingAssetPath(asset.account_id, asset.id),
    ].filter((p): p is string => Boolean(p));

    const admin = getSupabaseServerAdminClient();
    await admin.storage.from(IG_ASSETS_BUCKET).remove([...new Set(paths)]);

    const { error } = await client
      .from('ig_automation_assets')
      .delete()
      .eq('id', asset.id);

    if (error) {
      return NextResponse.json(
        { error: 'Could not delete the asset' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  },
  { auth: true },
);
