import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { isMissingColumnError } from '~/home/[account]/_lib/server/supabase-errors';
import { fetchCompanyLogoBytes } from '~/lib/clients/fetch-company-logo';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const AVATARS_BUCKET = 'account_image';
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

function storagePathFromPictureUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed || !trimmed.includes('/account_image/')) {
    return null;
  }

  return trimmed.split('/account_image/')[1]?.split('?')[0] ?? null;
}

function clientPhotoPath(accountId: string, clientId: string) {
  return `${accountId}/client-${clientId}`;
}

function isMissingPictureUrlColumn(error: unknown) {
  return isMissingColumnError(error);
}

async function ensureClientsEditPermission(
  userId: string,
  accountId: string,
): Promise<boolean> {
  const client = getSupabaseServerClient();
  const api = createTeamAccountsApi(client);
  const hasPermission = await api.hasPermission({
    userId,
    accountId,
    permission: 'clients.edit',
  });

  if (hasPermission) return true;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  return role === 'owner' || role === 'admin' || role === 'staff';
}

async function loadClient(
  accountId: string,
  clientId: string,
): Promise<{
  id: string;
  account_id: string;
  picture_url: string | null;
  email: string | null;
  website: string | null;
  pictureUrlAvailable: boolean;
} | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id, account_id, picture_url, email, website')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!error && data) {
    return {
      id: data.id as string,
      account_id: data.account_id as string,
      picture_url: (data.picture_url as string | null) ?? null,
      email: (data.email as string | null) ?? null,
      website: (data.website as string | null) ?? null,
      pictureUrlAvailable: true,
    };
  }

  if (!isMissingPictureUrlColumn(error)) {
    if (error) {
      // Retry without website if that column is missing (pre-migration).
      if (isMissingColumnError(error)) {
        const { data: legacy, error: legacyError } = await admin
          .from('clients')
          .select('id, account_id, picture_url, email')
          .eq('id', clientId)
          .eq('account_id', accountId)
          .maybeSingle();

        if (legacyError) {
          if (!isMissingPictureUrlColumn(legacyError)) {
            throw new Error(legacyError.message);
          }
        } else if (legacy) {
          return {
            id: legacy.id as string,
            account_id: legacy.account_id as string,
            picture_url: (legacy.picture_url as string | null) ?? null,
            email: (legacy.email as string | null) ?? null,
            website: null,
            pictureUrlAvailable: true,
          };
        }
      } else {
        throw new Error(error.message);
      }
    }
    return null;
  }

  const { data: fallback, error: fallbackError } = await admin
    .from('clients')
    .select('id, account_id, email')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (fallbackError) throw new Error(fallbackError.message);
  if (!fallback) return null;

  return {
    id: fallback.id as string,
    account_id: fallback.account_id as string,
    picture_url: null,
    email: (fallback.email as string | null) ?? null,
    website: null,
    pictureUrlAvailable: false,
  };
}

async function storeClientPhotoBytes(input: {
  accountId: string;
  clientId: string;
  existingPictureUrl: string | null;
  bytes: Buffer;
  contentType: string;
}) {
  const admin = getSupabaseServerAdminClient();
  const bucket = admin.storage.from(AVATARS_BUCKET);
  const existingPath = storagePathFromPictureUrl(input.existingPictureUrl);
  const nextPath = clientPhotoPath(input.accountId, input.clientId);

  if (existingPath && existingPath !== nextPath) {
    await bucket.remove([existingPath]);
  }

  const { error: uploadError } = await bucket.upload(nextPath, input.bytes, {
    contentType: input.contentType || 'image/png',
    upsert: true,
  });

  if (uploadError) {
    console.error('[clients] upload-photo:', uploadError.message);
    throw new Error(uploadError.message || 'Failed to upload photo.');
  }

  const publicUrl = toSupabasePublicStorageUrl(
    bucket.getPublicUrl(nextPath).data.publicUrl,
  );

  if (!publicUrl) {
    throw new Error('Upload succeeded but public URL could not be generated.');
  }

  const { nanoid } = await import('nanoid');
  const pictureUrl = `${publicUrl}?v=${nanoid(16)}`;

  const { error: updateError } = await admin
    .from('clients')
    .update({
      picture_url: pictureUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.clientId)
    .eq('account_id', input.accountId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return pictureUrl;
}

export async function POST(request: Request) {
  try {
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

    const accountId = formData.get('accountId');
    const clientId = formData.get('clientId');
    const remove = formData.get('remove') === '1';
    const fetchFromDomain = formData.get('fetchFromDomain') === '1';
    const domainOverride = String(formData.get('domain') ?? '').trim();
    const file = formData.get('file');

    if (typeof accountId !== 'string' || !accountId.trim()) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 },
      );
    }

    if (typeof clientId !== 'string' || !clientId.trim()) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 },
      );
    }

    const canEdit = await ensureClientsEditPermission(
      user.id,
      accountId.trim(),
    );
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const clientRow = await loadClient(accountId.trim(), clientId.trim());
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!clientRow.pictureUrlAvailable) {
      return NextResponse.json(
        {
          error:
            'The clients.picture_url column is missing on this database. From apps/web run `pnpm exec supabase login` then `pnpm exec supabase db push` (migration 20260725170000_repair_clients_picture_url).',
        },
        { status: 503 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const bucket = admin.storage.from(AVATARS_BUCKET);
    const existingPath = storagePathFromPictureUrl(clientRow.picture_url);

    if (remove) {
      if (existingPath) {
        await bucket.remove([existingPath]);
      }

      const { error: updateError } = await admin
        .from('clients')
        .update({
          picture_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientRow.id)
        .eq('account_id', clientRow.account_id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({ pictureUrl: null });
    }

    if (fetchFromDomain) {
      try {
        const logo = await fetchCompanyLogoBytes({
          domain: domainOverride || null,
          website: clientRow.website,
          email: clientRow.email,
        });

        const pictureUrl = await storeClientPhotoBytes({
          accountId: clientRow.account_id,
          clientId: clientRow.id,
          existingPictureUrl: clientRow.picture_url,
          bytes: logo.bytes,
          contentType: logo.contentType,
        });

        return NextResponse.json({
          pictureUrl,
          domain: logo.domain,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch logo.';
        const status =
          /No logo found|Enter a company domain|work email|cannot be used/i.test(
            message,
          )
            ? 422
            : 500;
        return NextResponse.json({ error: message }, { status });
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image uploads are allowed.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Max size is 5MB.' },
        { status: 400 },
      );
    }

    try {
      const pictureUrl = await storeClientPhotoBytes({
        accountId: clientRow.account_id,
        clientId: clientRow.id,
        existingPictureUrl: clientRow.picture_url,
        bytes: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || 'image/jpeg',
      });

      return NextResponse.json({ pictureUrl });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to upload client photo.',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[clients] upload-photo unhandled:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload client photo.',
      },
      { status: 500 },
    );
  }
}
