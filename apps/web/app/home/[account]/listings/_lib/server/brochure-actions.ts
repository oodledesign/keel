'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { BrochurePage } from '~/lib/commercial/brochure-pdf/brochure-document';
import { generateListingBrochurePdf } from '~/lib/commercial/brochure-pdf/generate-listing-brochure-pdf';

import {
  GetListingBrochureDocumentSchema,
  PublishListingBrochurePdfSchema,
  RegenerateListingBrochureSchema,
  SaveListingBrochureDocumentSchema,
} from '../schema/brochure.schema';
import { createListingBrochureService } from './listing-brochure.service';
import { createListingsService } from './listings.service';

function getService() {
  return createListingBrochureService(getSupabaseServerClient());
}

export const getListingBrochureDocument = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return getService().getOrCreateDocument({
      listingId: input.listingId,
      accountId: input.accountId,
      orientation: input.orientation,
    });
  },
  { schema: GetListingBrochureDocumentSchema },
);

export const saveListingBrochureDocument = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );

    return getService().savePages({
      listingId: input.listingId,
      accountId: input.accountId,
      orientation: input.orientation,
      templateId: input.templateId,
      pages: input.pages as BrochurePage[],
    });
  },
  { schema: SaveListingBrochureDocumentSchema },
);

export const regenerateListingBrochure = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return getService().regenerateFromTemplate(input);
  },
  { schema: RegenerateListingBrochureSchema },
);

/**
 * Generate a brochure PDF and store it on the listing as Media → Brochure
 * so portal publish/republish can pick it up.
 */
export const publishListingBrochurePdf = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );

    const client = getSupabaseServerClient();
    const brochureService = createListingBrochureService(client);
    const listingsService = createListingsService(client);

    const saved = input.useSaved
      ? await brochureService.getDocument(
          input.listingId,
          input.accountId,
          input.orientation,
        )
      : null;

    const { bytes, filename, document } = await generateListingBrochurePdf({
      listingId: input.listingId,
      accountId: input.accountId,
      orientation: saved?.orientation ?? input.orientation,
      templateId: saved?.templateId ?? input.templateId,
      document: saved,
      display: saved
        ? { showReducedPrice: input.display?.showReducedPrice }
        : input.display,
    });

    if (!saved) {
      try {
        await brochureService.upsertDocument({
          listingId: input.listingId,
          accountId: input.accountId,
          document,
        });
      } catch (persistErr) {
        console.error(
          '[brochure-pdf] persist doc failed:',
          persistErr instanceof Error ? persistErr.message : persistErr,
        );
      }
    }

    const storagePath = `${input.accountId}/${input.listingId}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await client.storage
      .from('commercial-listing-media')
      .upload(storagePath, Buffer.from(bytes), {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const media = await listingsService.createMedia({
      accountId: input.accountId,
      listingId: input.listingId,
      mediaType: 'brochure',
      storagePath,
      fileName: filename,
      mimeType: 'application/pdf',
      sortOrder: 0,
    });

    const [withUrl] = await listingsService.withSignedMediaUrls([media]);
    return withUrl ?? media;
  },
  { schema: PublishListingBrochurePdfSchema },
);
