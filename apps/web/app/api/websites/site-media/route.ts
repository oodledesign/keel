import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

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
  'image/svg+xml',
]);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

async function canAccessSiteMedia(
  userId: string,
  accountId: string,
): Promise<boolean> {
  const client = getSupabaseServerClient();
  const api = createTeamAccountsApi(client);
  const permitted = await api.hasPermission({
    userId,
    accountId,
    permission: 'jobs.edit',
  });
  if (permitted) return true;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  const role = membership?.account_role;
  if (role === 'owner' || role === 'admin' || role === 'staff') return true;

  const { data: orgs } = await client
    .from('client_orgs')
    .select('id')
    .eq('business_id', accountId);
  const orgIds = (orgs ?? []).map((row) => row.id as string);
  if (orgIds.length === 0) return false;

  const { data: member } = await client
    .from('client_members')
    .select('id')
    .eq('user_id', userId)
    .in('client_org_id', orgIds)
    .limit(1)
    .maybeSingle();

  return Boolean(member);
}

function publicUrlForPath(path: string) {
  const admin = getSupabaseServerAdminClient();
  return toSupabasePublicStorageUrl(
    admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
  );
}

type ListedMedia = {
  url: string;
  path: string;
  name: string;
  updatedAt: string | null;
};

async function listPrefix(prefix: string): Promise<ListedMedia[]> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
    limit: 200,
    sortBy: { column: 'updated_at', order: 'desc' },
  });

  if (error || !data) return [];

  return data
    .filter((item) => Boolean(item.name) && !item.name.endsWith('/'))
    .filter((item) => {
      // Skip nested folders when listing the legacy account-level prefix.
      const meta = item.metadata as { mimetype?: string } | null;
      return Boolean(meta?.mimetype || item.id);
    })
    .map((item) => {
      const path = `${prefix}/${item.name}`;
      return {
        name: item.name,
        path,
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

  const { searchParams } = new URL(request.url);
  const accountIdParsed = z
    .string()
    .uuid()
    .safeParse(searchParams.get('accountId'));
  const websiteIdParsed = z
    .string()
    .uuid()
    .safeParse(searchParams.get('websiteId'));

  if (!accountIdParsed.success) {
    return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
  }

  const accountId = accountIdParsed.data;
  if (!(await canAccessSiteMedia(user.id, accountId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const websiteId = websiteIdParsed.success ? websiteIdParsed.data : null;
  const sitePrefix = websiteId
    ? `${accountId}/sites/${websiteId}`
    : `${accountId}/sites`;
  const legacyPrefix = `${accountId}/sites`;

  const [siteItems, legacyItems] = await Promise.all([
    listPrefix(sitePrefix),
    websiteId ? listPrefix(legacyPrefix) : Promise.resolve([]),
  ]);

  // Prefer site-scoped assets; include legacy account-level files that are
  // direct objects (not folders) for older uploads.
  const byPath = new Map<string, ListedMedia>();
  for (const item of [...legacyItems, ...siteItems]) {
    // Skip directory placeholders returned when listing account/sites.
    if (!item.name.includes('.')) continue;
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
  const websiteIdParsed = z.string().uuid().safeParse(form.get('websiteId'));
  const file = form.get('file');

  if (!accountIdParsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const accountId = accountIdParsed.data;
  const websiteId = websiteIdParsed.success ? websiteIdParsed.data : null;

  if (!(await canAccessSiteMedia(user.id, accountId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type' },
      { status: 400 },
    );
  }

  const ext = MIME_TO_EXT[file.type] ?? 'jpg';
  const folder = websiteId
    ? `${accountId}/sites/${websiteId}`
    : `${accountId}/sites`;
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
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
