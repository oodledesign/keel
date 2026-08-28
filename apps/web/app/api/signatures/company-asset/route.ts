import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isSignaturesModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { updateSignaturesCompanyAssetUrls } from '~/lib/signatures/workspace-settings';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const BRAND_ASSETS_BUCKET = 'brand-assets';
const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

type CompanyAssetKind = 'logo' | 'icon';

function extensionForMime(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

function parseKind(raw: unknown): CompanyAssetKind | null {
  const value = String(raw ?? '').trim();
  if (value === 'logo' || value === 'icon') {
    return value;
  }
  return null;
}

async function assertSignaturesAdmin(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Account admin required' },
      { status: 403 },
    );
  }

  const { data: rows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId);

  const moduleSettings = Object.fromEntries(
    (rows ?? []).map((row) => [row.module_key, row.enabled]),
  ) as Record<string, boolean>;

  if (!isSignaturesModuleEnabled(moduleSettings)) {
    return NextResponse.json(
      { error: 'Signatures is disabled for this account' },
      { status: 403 },
    );
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return null;
}

export async function POST(request: Request) {
  const userClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const accountId = String(formData.get('accountId') ?? '').trim();
  const kind = parseKind(formData.get('kind'));
  const file = formData.get('file');

  if (!accountId || !kind || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'accountId, kind (logo|icon), and file are required.' },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Only PNG, JPEG, WebP, or GIF uploads are allowed.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_ASSET_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Image is too large. Max size is 5MB.' },
      { status: 400 },
    );
  }

  const authError = await assertSignaturesAdmin(accountId, user.id);
  if (authError) return authError;

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extensionForMime(file.type || 'image/jpeg');
  const path = `${accountId}/signatures/company-${kind}-${Date.now()}.${ext}`;
  const admin = getSupabaseServerAdminClient();

  const { error: uploadError } = await admin.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('[signatures] company-asset upload:', uploadError.message);
    const hint =
      uploadError.message?.toLowerCase().includes('bucket') ||
      uploadError.message?.toLowerCase().includes('not found')
        ? ' Run Supabase migrations to create the brand-assets storage bucket.'
        : '';
    return NextResponse.json(
      {
        error:
          (uploadError.message || 'Failed to upload company asset.') + hint,
      },
      { status: 500 },
    );
  }

  const publicUrl = toSupabasePublicStorageUrl(
    admin.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl,
  );

  if (!publicUrl) {
    return NextResponse.json(
      { error: 'Upload succeeded but public URL could not be generated.' },
      { status: 500 },
    );
  }

  const { nanoid } = await import('nanoid');
  const assetUrl = `${publicUrl}?v=${nanoid(16)}`;

  try {
    await updateSignaturesCompanyAssetUrls(accountId, {
      ...(kind === 'logo'
        ? { company_logo_url: assetUrl }
        : { company_icon_url: assetUrl }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to save company asset URL.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    kind,
    url: assetUrl,
  });
}

export async function DELETE(request: Request) {
  const userClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { accountId?: string; kind?: string };
  try {
    body = (await request.json()) as { accountId?: string; kind?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const accountId = String(body.accountId ?? '').trim();
  const kind = parseKind(body.kind);

  if (!accountId || !kind) {
    return NextResponse.json(
      { error: 'accountId and kind (logo|icon) are required.' },
      { status: 400 },
    );
  }

  const authError = await assertSignaturesAdmin(accountId, user.id);
  if (authError) return authError;

  try {
    await updateSignaturesCompanyAssetUrls(accountId, {
      ...(kind === 'logo'
        ? { company_logo_url: null }
        : { company_icon_url: null }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to remove company asset.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, kind });
}
