import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { COMMERCIAL_LISTING_MEDIA_BUCKET } from '~/lib/commercial/migrate-external-listing-media';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{ id: string; file: string }>;
};

type MediaRow = {
  id: string;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_name: string | null;
  is_private: boolean | null;
  created_at: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function loadPublicMedia(id: string): Promise<MediaRow | null> {
  if (!isUuid(id)) return null;

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('commercial_listing_media')
    .select(
      'id, storage_path, external_url, mime_type, file_name, is_private, created_at',
    )
    .eq('id', id)
    .eq('is_private', false)
    .maybeSingle();

  if (error) {
    console.error('[listing-media] lookup failed', id, error.message);
    return null;
  }
  if (!data) return null;
  return data as MediaRow;
}

function etagFor(row: MediaRow): string {
  const stamp = row.created_at ?? row.storage_path ?? row.id;
  return `"${Buffer.from(stamp).toString('base64url')}"`;
}

async function serveMedia(
  request: Request,
  id: string,
  method: 'GET' | 'HEAD',
): Promise<NextResponse> {
  const limited = rateLimitApiRequest(request, {
    scope: 'commercial-listing-media',
    limit: 120,
  });
  if (limited) return limited;

  const row = await loadPublicMedia(id);
  if (!row) {
    return new NextResponse('Not found', { status: 404 });
  }

  const etag = etagFor(row);
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  }

  const storagePath = row.storage_path?.trim() || null;
  if (storagePath) {
    const admin = getSupabaseServerAdminClient();
    const { data, error } = await admin.storage
      .from(COMMERCIAL_LISTING_MEDIA_BUCKET)
      .download(storagePath);

    if (error || !data) {
      console.error('[listing-media]', id, error?.message ?? 'download failed');
      return new NextResponse('Media unavailable', { status: 502 });
    }

    const contentType =
      row.mime_type?.trim() || data.type || 'application/octet-stream';
    const buffer = Buffer.from(await data.arrayBuffer());
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      ETag: etag,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    };
    if (row.file_name?.trim()) {
      headers['Content-Disposition'] =
        `inline; filename="${row.file_name.replace(/"/g, '')}"`;
    }

    if (method === 'HEAD') {
      return new NextResponse(null, { status: 200, headers });
    }

    return new NextResponse(buffer, { status: 200, headers });
  }

  const external = row.external_url?.trim() || null;
  if (!external) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Stable short URL for Rightmove. HEAD must not 302 — Rightmove uses
  // conditional HEAD/ETag before downloading.
  if (method === 'HEAD') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': row.mime_type?.trim() || 'application/octet-stream',
        ETag: etag,
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return NextResponse.redirect(external, {
    status: 302,
    headers: {
      ETag: etag,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

/**
 * Public marketing media proxy for portal publishers (Rightmove).
 * GET/HEAD /api/commercial/listing-media/:id/:file
 * Only non-private rows are served.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  return serveMedia(request, id, 'GET');
}

export async function HEAD(request: Request, { params }: RouteParams) {
  const { id } = await params;
  return serveMedia(request, id, 'HEAD');
}
