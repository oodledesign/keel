'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { INSUFFICIENT_AI_CREDITS_CODE } from '~/lib/ai/ai-credits-exhausted';
import { isInsufficientCreditsError } from '~/lib/ai/router';
import { generateListingMarketingCopy } from '~/lib/commercial/ai-listing-marketing';

import { createListingsService } from './listings.service';

const GenerateListingMarketingCopySchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
});

export const generateListingMarketingCopyAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const listing = await createListingsService(client).getListing(
      input.listingId,
      input.accountId,
    );
    if (!listing) {
      throw new Error('Listing not found');
    }

    try {
      return await generateListingMarketingCopy({
        accountId: input.accountId,
        supabase: client,
        listing: {
          name: listing.name,
          disposalType: listing.disposalType,
          sector: listing.sector,
          tenure: listing.tenure,
          addressLine1: listing.addressLine1,
          addressLine2: listing.addressLine2,
          town: listing.town,
          county: listing.county,
          postcode: listing.postcode,
          sizeMinSqft: listing.sizeMinSqft,
          sizeMaxSqft: listing.sizeMaxSqft,
          askingRent: listing.askingRentPence,
          askingPrice: listing.askingPricePence,
          rentFrequency: listing.rentFrequency,
          useClass: listing.useClass,
          availableFrom: listing.availableFrom,
          epcBand: listing.epcBand,
          epcRating:
            listing.epcRating != null ? String(listing.epcRating) : null,
          existingSummary: listing.summary,
          existingDescription: listing.description,
        },
      });
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        throw new Error(
          `Not enough AI credits (need ${error.creditsRequired}, have ${error.creditsRemaining}). [${INSUFFICIENT_AI_CREDITS_CODE}]`,
        );
      }
      throw error;
    }
  },
  { schema: GenerateListingMarketingCopySchema },
);
