import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { denyUnlessCampaignsAccess } from '~/lib/campaigns/require-campaigns-api-access';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export const runtime = 'nodejs';

const BUCKET = 'account_image';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export type CampaignMediaItem = {
  url: string;
  path: string;
  name: string;
  source: 'campaigns' | 'sites';
  updatedAt: string | null;
};

async function canAccessCampaignMedia(userId: string, accountId: string) {
  const client = getSupabaseServerClient();
  const denied = await denyUnlessCampaignsAccess(client, userId, accountId);
  if (denied) return denied;

  const isMember =
    accountId === userId ||
    (await userIsAccountMember(client, userId, accountId));
  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

function publicUrlForPath(path: string) {
  const admin = getSupabaseServerAdminClient();
  return toSupabasePublicStorageUrl(
    admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
  );
}

async function listPrefix(
  prefix: string,
  source: CampaignMediaItem['source'],
): Promise<CampaignMediaItem[]> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
    limit: 200,
    sortBy: { column: 'updated_at', order: 'desc' },
  });

  if (error || !data) return [];

  return data
    .filter((item) => Boolean(item.name) && !item.name.endsWith('/'))
    .filter((item) => item.name.includes('.'))
    .map((item) => {
      const path = `${prefix}/${item.name}`;
      return {
        name: item.name,
        path,
        source,
        url: publicUrlForPath(path) ?? '',
        updatedAt: item.updated_at ?? null,
      };
    })
    .filter((item) => Boolean(item.url));
}

export async function GET(request: Request) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const accountIdParsed = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get('accountId'));

  if (!accountIdParsed.success) {
    return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
  }

  const accountId = accountIdParsed.data;
  const denied = await canAccessCampaignMedia(user.id, accountId);
  if (denied) return denied;

  const [campaignItems, siteItems] = await Promise.all([
    listPrefix(`${accountId}/campaigns`, 'campaigns'),
    listPrefix(`${accountId}/sites`, 'sites'),
  ]);

  const byPath = new Map<string, CampaignMediaItem>();
  for (const item of [...siteItems, ...campaignItems]) {
    byPath.set(item.path, item);
  }

  const items = Array.from(byPath.values()).sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  );

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const form = await request.formData();
  const accountIdParsed = z.string().uuid().safeParse(form.get('accountId'));
  const file = form.get('file');

  if (!accountIdParsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const accountId = accountIdParsed.data;
  const denied = await canAccessCampaignMedia(user.id, accountId);
  if (denied) return denied;

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large (max 5 MB)' },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type' },
      { status: 400 },
    );
  }

  const ext = MIME_TO_EXT[file.type] ?? 'jpg';
  const path = `${accountId}/campaigns/${crypto.randomUUID()}.${ext}`;
  const admin = getSupabaseServerAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const url = publicUrlForPath(path);
  if (!url) {
    return NextResponse.json(
      { error: 'Could not generate public URL' },
      { status: 500 },
    );
  }

  return NextResponse.json({ url, path });
}
