import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { assertCanEditBrandSettings } from '~/home/[account]/settings/_lib/server/brand-settings-access';
import {
  saveBrandLogoVariant,
  syncWorkspaceLogo,
} from '~/lib/brand/sync-workspace-logo';
import { uploadWorkspaceLogo } from '~/lib/brand/upload-workspace-logo';

export const runtime = 'nodejs';

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const LOGO_VARIANTS = ['primary', 'on_light', 'on_dark'] as const;

type LogoUploadVariant = (typeof LOGO_VARIANTS)[number];

function parseLogoVariant(value: unknown): LogoUploadVariant {
  const raw = String(value ?? 'primary').trim();
  return LOGO_VARIANTS.includes(raw as LogoUploadVariant)
    ? (raw as LogoUploadVariant)
    : 'primary';
}

async function authorizeWorkspaceLogoEdit(accountId: string, userId: string) {
  try {
    await assertCanEditBrandSettings(accountId, userId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'You cannot edit workspace settings.';
    const status = message === 'Account not found' ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
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
  const variant = parseLogoVariant(formData.get('variant'));
  const file = formData.get('file');

  if (!accountId || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'accountId and file are required.' },
      { status: 400 },
    );
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Only image uploads are allowed.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Logo is too large. Max size is 5MB.' },
      { status: 400 },
    );
  }

  const authError = await authorizeWorkspaceLogoEdit(accountId, user.id);
  if (authError) return authError;

  let pictureUrl: string;
  try {
    pictureUrl = await uploadWorkspaceLogo({
      accountId,
      variant,
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'image/jpeg',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save workspace logo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ logoUrl: pictureUrl, pictureUrl, variant });
}

export async function DELETE(request: Request) {
  const userClient = getSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { accountId?: string; variant?: string };
  try {
    body = (await request.json()) as { accountId?: string; variant?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const accountId = String(body.accountId ?? '').trim();
  const variant = parseLogoVariant(body.variant);
  if (!accountId) {
    return NextResponse.json(
      { error: 'accountId is required.' },
      { status: 400 },
    );
  }

  const authError = await authorizeWorkspaceLogoEdit(accountId, user.id);
  if (authError) return authError;

  try {
    if (variant === 'primary') {
      await syncWorkspaceLogo(accountId, null);
    } else if (variant === 'on_light' || variant === 'on_dark') {
      await saveBrandLogoVariant(accountId, variant, null);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to remove workspace logo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
