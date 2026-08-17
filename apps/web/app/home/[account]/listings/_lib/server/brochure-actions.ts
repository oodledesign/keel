'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { BrochurePage } from '~/lib/commercial/brochure-pdf/brochure-document';

import {
  GetListingBrochureDocumentSchema,
  RegenerateListingBrochureSchema,
  SaveListingBrochureDocumentSchema,
} from '../schema/brochure.schema';
import { createListingBrochureService } from './listing-brochure.service';

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
