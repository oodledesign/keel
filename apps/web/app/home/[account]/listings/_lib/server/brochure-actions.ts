'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type {
  BrochureOrientation,
  BrochurePage,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { generateListingBrochurePdf } from '~/lib/commercial/brochure-pdf/generate-listing-brochure-pdf';
import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';

import {
  GetListingBrochureDocumentSchema,
  LoadBrochureWizardSchema,
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

/** Everything the brochure wizard needs before its first step. */
export const loadBrochureWizard = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );

    const [data, documents] = await Promise.all([
      loadListingBrochureData(input.listingId, input.accountId),
      getService().listDocuments(input.listingId, input.accountId),
    ]);
    if (!data) throw new Error('Listing not found');

    const saved = (orientation: BrochureOrientation) => {
      const doc = documents.find((d) => d.orientation === orientation);
      return doc
        ? {
            templateId: doc.templateId,
            updatedAt: doc.updatedAt ?? null,
            pageCount: doc.pages.length,
          }
        : null;
    };

    return {
      accountName: data.accountName,
      brand: {
        logoUrl: data.brand.logoUrl,
        logoOnLightUrl: data.brand.logoOnLightUrl ?? null,
        logoOnDarkUrl: data.brand.logoOnDarkUrl ?? null,
        primaryColor: data.brand.primaryColor,
        secondaryColor: data.brand.secondaryColor,
        accentColor: data.brand.accentColor,
      },
      images: data.images,
      floorplans: data.floorplans,
      saved: {
        landscape: saved('landscape'),
        portrait: saved('portrait'),
      },
    };
  },
  { schema: LoadBrochureWizardSchema },
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
 * Render the approved saved layout and store it on the listing as
 * Media → Brochure, replacing the previously published PDF, so the website,
 * EACH and Rightmove only ever receive a brochure someone has checked.
 */
export const publishListingBrochurePdf = enhanceAction(
  async (input, user) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );

    const client = getSupabaseServerClient();
    const brochureService = createListingBrochureService(client);
    const listingsService = createListingsService(client);

    const saved = await brochureService.getDocument(
      input.listingId,
      input.accountId,
      input.orientation,
    );
    if (!saved) {
      throw new Error('Create and review the brochure before publishing.');
    }
    if (saved.updatedAt !== input.reviewedUpdatedAt) {
      throw new Error(
        'The brochure changed after you previewed it. Preview it again before publishing.',
      );
    }

    const { bytes, filename } = await generateListingBrochurePdf({
      listingId: input.listingId,
      accountId: input.accountId,
      orientation: saved.orientation,
      templateId: saved.templateId,
      document: saved,
      display: {
        showReducedPrice: input.display?.showReducedPrice,
        showWebsiteListingButton: input.display?.showWebsiteListingButton,
        showSlideshowBrochureButton: input.display?.showSlideshowBrochureButton,
      },
    });

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

    const replaced = await brochureService.recordPublished({
      listingId: input.listingId,
      accountId: input.accountId,
      orientation: saved.orientation,
      mediaId: media.id,
      userId: user.id,
    });
    for (const mediaId of replaced) {
      try {
        await listingsService.deleteMedia(
          mediaId,
          input.accountId,
          input.listingId,
        );
      } catch (err) {
        console.error(
          '[brochure-pdf] remove replaced brochure failed:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    await listingsService.syncPortalsAfterMediaChange({
      accountId: input.accountId,
      listingId: input.listingId,
    });

    const [withUrl] = await listingsService.withSignedMediaUrls([media]);
    return withUrl ?? media;
  },
  { schema: PublishListingBrochurePdfSchema },
);
