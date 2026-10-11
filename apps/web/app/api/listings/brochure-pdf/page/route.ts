import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { BrochurePagePreviewSchema } from '~/home/[account]/listings/_lib/schema/brochure.schema';
import { loadBrochurePreviewData } from '~/lib/commercial/brochure-pdf/brochure-preview-data';
import { generateListingBrochurePdf } from '~/lib/commercial/brochure-pdf/generate-listing-brochure-pdf';

/**
 * POST /api/listings/brochure-pdf/page
 * Renders one page of the wizard's working layout. 204 when the page would be
 * left out of the PDF (a photo page with no photos).
 */
export const POST = enhanceRouteHandler(
  async ({ body }) => {
    const { listingId, accountId, templateId, orientation, pages, pageId } =
      body;
    if (!pages.some((page) => page.id === pageId)) {
      return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { data: listing, error: listingError } = await client
      .from('commercial_listings')
      .select('id')
      .eq('id', listingId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(accountId, 'create or edit disposals');

    try {
      const data = await loadBrochurePreviewData(listingId, accountId);
      if (!data) {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 },
        );
      }
      const { bytes, document, warnings } = await generateListingBrochurePdf({
        listingId,
        accountId,
        orientation,
        templateId,
        data,
        document: {
          listingId,
          templateId,
          orientation,
          pageSize: 'A4',
          pages,
        },
        display: {
          showReducedPrice: body.display?.showReducedPrice,
          showWebsiteListingButton: body.display?.showWebsiteListingButton,
          showSlideshowBrochureButton:
            body.display?.showSlideshowBrochureButton,
        },
        pageIds: [pageId],
      });

      if (!document.pages.some((page) => page.id === pageId)) {
        return new NextResponse(null, { status: 204 });
      }

      const out = Buffer.from(bytes);
      return new NextResponse(out, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(out.length),
          'Cache-Control': 'private, no-store',
          'X-Brochure-Warnings': encodeURIComponent(
            JSON.stringify(warnings.filter((w) => w.pageId === pageId)),
          ),
        },
      });
    } catch (err) {
      console.error(
        '[brochure-pdf/page] render failed:',
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: 'Failed to render the page' },
        { status: 500 },
      );
    }
  },
  { auth: true, schema: BrochurePagePreviewSchema },
);
