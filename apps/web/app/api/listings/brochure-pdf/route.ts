import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { BrochurePdfQuerySchema } from '~/home/[account]/listings/_lib/schema/brochure.schema';
import { createListingBrochureService } from '~/home/[account]/listings/_lib/server/listing-brochure.service';
import { generateListingBrochurePdf } from '~/lib/commercial/brochure-pdf/generate-listing-brochure-pdf';

/**
 * GET /api/listings/brochure-pdf?listingId=&accountId=&orientation=&template=&useSaved=
 */
export const GET = enhanceRouteHandler(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const parsed = BrochurePdfQuerySchema.safeParse({
      listingId: searchParams.get('listingId'),
      accountId: searchParams.get('accountId'),
      orientation: searchParams.get('orientation') ?? undefined,
      template: searchParams.get('template') ?? undefined,
      useSaved: searchParams.get('useSaved') ?? undefined,
      showRent: searchParams.get('showRent') ?? undefined,
      showPrice: searchParams.get('showPrice') ?? undefined,
      showSize: searchParams.get('showSize') ?? undefined,
      showRates: searchParams.get('showRates') ?? undefined,
      showServiceCharge: searchParams.get('showServiceCharge') ?? undefined,
      showEstateCharge: searchParams.get('showEstateCharge') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid listingId, accountId, orientation, or template' },
        { status: 400 },
      );
    }

    const {
      listingId,
      accountId,
      orientation,
      template,
      useSaved,
      showRent,
      showPrice,
      showSize,
      showRates,
      showServiceCharge,
      showEstateCharge,
    } = parsed.data;
    const client = getSupabaseServerClient();

    // Ensure membership via RLS on listing
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
      const service = createListingBrochureService(client);
      const saved = useSaved
        ? await service.getDocument(listingId, accountId, orientation)
        : null;

      const display = {
        showRent,
        showPrice,
        showSize,
        showRates,
        showServiceCharge,
        showEstateCharge,
      };

      const { bytes, filename, document } = await generateListingBrochurePdf({
        listingId,
        accountId,
        orientation: saved?.orientation ?? orientation,
        templateId: saved?.templateId ?? template,
        document: saved,
        // Saved docs already bake facts in; display only applies to fresh packs.
        display: saved ? undefined : display,
      });

      // Persist auto pack when downloading without a saved doc so the editor starts warm
      if (!saved) {
        try {
          await service.upsertDocument({
            listingId,
            accountId,
            document,
          });
        } catch (persistErr) {
          console.error(
            '[brochure-pdf] persist doc failed:',
            persistErr instanceof Error ? persistErr.message : persistErr,
          );
        }
      }

      const body = Buffer.from(bytes);
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(body.length),
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (err) {
      console.error(
        '[brochure-pdf] generate failed:',
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json(
        { error: 'Failed to generate brochure PDF' },
        { status: 500 },
      );
    }
  },
  { auth: true },
);
