import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type {
  BrochureDocument,
  BrochureOrientation,
  BrochurePage,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { generateListingBrochurePdf } from '~/lib/commercial/brochure-pdf/generate-listing-brochure-pdf';
import {
  type FeedBrochureDocumentRow,
  pickFeedBrochureDocument,
  shouldPublishOzerBrochureToFeed,
} from '~/lib/commercial/property-hive-feed-brochures';
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

function asTemplate(value: string): BrochureTemplateId {
  if (value === 'editorial' || value === 'compact') return value;
  return 'classic';
}

function asOrientation(value: string): BrochureOrientation {
  return value === 'landscape' ? 'landscape' : 'portrait';
}

type ListingGate = {
  id: string;
  account_id: string;
  status: string;
  brochure_share_enabled: boolean | null;
};

async function loadPublishableBrochure(listingId: string): Promise<{
  listing: ListingGate;
  document: FeedBrochureDocumentRow | null;
} | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('commercial_listings')
    .select('id, account_id, status, brochure_share_enabled')
    .eq('id', listingId)
    .maybeSingle();

  if (error || !data) return null;
  const listing = data as ListingGate;
  if (!ON_MARKET_STATUSES.has(listing.status)) return null;

  const { data: docs, error: docError } = await admin
    .from('commercial_listing_brochures')
    .select('listing_id, orientation, template_id, pages, updated_at')
    .eq('listing_id', listingId);

  if (docError) {
    console.error('[listing-brochure] document load error:', docError.message);
    return null;
  }

  const documents: FeedBrochureDocumentRow[] = (docs ?? []).map((row) => ({
    listingId: row.listing_id,
    orientation: row.orientation,
    templateId: row.template_id,
    pages: row.pages,
    updatedAt: row.updated_at,
  }));

  if (
    !shouldPublishOzerBrochureToFeed({
      shareEnabled: Boolean(listing.brochure_share_enabled),
      documents,
    })
  ) {
    return null;
  }

  return { listing, document: pickFeedBrochureDocument(documents) };
}

function savedDocument(
  listingId: string,
  document: FeedBrochureDocumentRow | null,
): BrochureDocument | undefined {
  if (!document || !Array.isArray(document.pages) || !document.pages.length) {
    return undefined;
  }
  return {
    listingId,
    templateId: asTemplate(document.templateId),
    pageSize: 'A4',
    orientation: asOrientation(document.orientation),
    pages: document.pages as BrochurePage[],
    updatedAt: document.updatedAt,
  };
}

/**
 * Public PDF for Property Hive `<files>` when the Ozer brochure is a saved
 * document or an enabled share link rather than an uploaded media file.
 * GET/HEAD /api/commercial/listing-brochure/:listingId/brochure-v….pdf
 * On-market listings only. The filename is a cache-buster; the row wins.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const limited = rateLimitApiRequest(request, {
    scope: 'commercial-listing-brochure',
    limit: 30,
  });
  if (limited) return limited;

  const { listingId, file } = await params;
  if (!isUuid(listingId) || !file.toLowerCase().endsWith('.pdf')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const publishable = await loadPublishableBrochure(listingId);
  if (!publishable) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const saved = savedDocument(listingId, publishable.document);
    const { bytes, filename } = await generateListingBrochurePdf({
      listingId,
      accountId: publishable.listing.account_id,
      orientation: saved?.orientation ?? 'portrait',
      templateId: saved?.templateId ?? 'classic',
      document: saved,
      client: getSupabaseServerAdminClient(),
    });

    const body = Buffer.from(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(body.length),
        'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error(
      '[listing-brochure] pdf failed',
      listingId,
      err instanceof Error ? err.message : err,
    );
    return new NextResponse('Brochure unavailable', { status: 502 });
  }
}

export async function HEAD(request: Request, { params }: RouteParams) {
  const limited = rateLimitApiRequest(request, {
    scope: 'commercial-listing-brochure',
    limit: 30,
  });
  if (limited) return limited;

  const { listingId, file } = await params;
  if (!isUuid(listingId) || !file.toLowerCase().endsWith('.pdf')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const publishable = await loadPublishableBrochure(listingId);
  if (!publishable) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
