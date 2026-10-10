import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { buildCommercialListingMediaPublicPath } from '~/lib/commercial/listing-media-public-url';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ON_MARKET_STATUSES = new Set(['marketing', 'under_offer']);

type RouteParams = {
  params: Promise<{ listingId: string; file: string }>;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Media path of the listing's approved, published brochure PDF. */
async function publishedBrochurePath(
  listingId: string,
): Promise<string | null> {
  const admin = getSupabaseServerAdminClient();
  const { data: listing, error } = await admin
    .from('commercial_listings')
    .select('id, status')
    .eq('id', listingId)
    .maybeSingle();
  if (error || !listing || !ON_MARKET_STATUSES.has(listing.status)) {
    return null;
  }

  const { data: docs, error: docError } = await admin
    .from('commercial_listing_brochures')
    .select('published_media_id, approved_at')
    .eq('listing_id', listingId)
    .not('published_media_id', 'is', null)
    .order('approved_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (docError) {
    console.error('[listing-brochure] document load error:', docError.message);
    return null;
  }
  const mediaId = docs?.[0]?.published_media_id;
  if (!mediaId) return null;

  const { data: media } = await admin
    .from('commercial_listing_media')
    .select('id, media_type, file_name, mime_type, is_private')
    .eq('id', mediaId)
    .eq('listing_id', listingId)
    .maybeSingle();
  if (!media || media.is_private) return null;

  return buildCommercialListingMediaPublicPath({
    mediaId: media.id,
    mediaType: media.media_type,
    fileName: media.file_name,
    mimeType: media.mime_type,
  });
}

/**
 * Older Website/EACH feeds linked here for a live-rendered brochure. Portals
 * keep those URLs, so send them to the approved, published PDF instead; with
 * nothing published there is no brochure to serve.
 * GET/HEAD /api/commercial/listing-brochure/:listingId/brochure-v….pdf
 */
async function handle(request: Request, { params }: RouteParams) {
  const limited = rateLimitApiRequest(request, {
    scope: 'commercial-listing-brochure',
    limit: 30,
  });
  if (limited) return limited;

  const { listingId, file } = await params;
  if (!isUuid(listingId) || !file.toLowerCase().endsWith('.pdf')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const path = await publishedBrochurePath(listingId);
  if (!path) return new NextResponse('Not found', { status: 404 });

  return NextResponse.redirect(new URL(path, request.url), {
    status: 302,
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}

export const GET = handle;
export const HEAD = handle;
