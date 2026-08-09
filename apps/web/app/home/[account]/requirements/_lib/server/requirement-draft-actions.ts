'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { INSUFFICIENT_AI_CREDITS_CODE } from '~/lib/ai/ai-credits-exhausted';
import { isInsufficientCreditsError } from '~/lib/ai/router';
import { draftRequirementFromText } from '~/lib/commercial/ai-requirement-draft';

import { createListingsService } from '../../../listings/_lib/server/listings.service';
import {
  DraftRequirementFromEnquirySchema,
  DraftRequirementFromPasteSchema,
} from '../schema/requirements.schema';

export const draftRequirementFromPaste = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    try {
      return await draftRequirementFromText({
        accountId: input.accountId,
        supabase: client,
        text: input.text,
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
  { schema: DraftRequirementFromPasteSchema },
);

export const draftRequirementFromEnquiry = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const listings = createListingsService(client);
    const enquiry = await listings.getEnquiry(input.enquiryId, input.accountId);
    if (!enquiry) {
      throw new Error('Enquiry not found');
    }

    const listing = enquiry.listingId
      ? await listings.getListing(enquiry.listingId, input.accountId)
      : null;

    const sourceText = [
      enquiry.message,
      enquiry.areasText ? `Areas: ${enquiry.areasText}` : null,
      enquiry.propertyTypes ? `Property types: ${enquiry.propertyTypes}` : null,
      enquiry.tenure ? `Tenure: ${enquiry.tenure}` : null,
      enquiry.targetSizeMinSqft != null || enquiry.targetSizeMaxSqft != null
        ? `Size: ${enquiry.targetSizeMinSqft ?? '?'}–${enquiry.targetSizeMaxSqft ?? '?'} sq ft`
        : null,
      enquiry.contactName ? `Contact: ${enquiry.contactName}` : null,
      enquiry.contactEmail ? `Email: ${enquiry.contactEmail}` : null,
      enquiry.contactPhone ? `Phone: ${enquiry.contactPhone}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      return await draftRequirementFromText({
        accountId: input.accountId,
        supabase: client,
        text: sourceText || 'Occupier enquiry with limited structured fields.',
        enquiry: {
          contactName: enquiry.contactName,
          contactEmail: enquiry.contactEmail,
          contactPhone: enquiry.contactPhone,
          message: enquiry.message,
          areasText: enquiry.areasText,
          propertyTypes: enquiry.propertyTypes,
          tenure: enquiry.tenure,
          targetSizeMinSqft: enquiry.targetSizeMinSqft,
          targetSizeMaxSqft: enquiry.targetSizeMaxSqft,
          source: enquiry.source,
        },
        listingHint: listing
          ? {
              name: listing.name,
              sector: listing.sector,
              addressLine1: listing.addressLine1,
              town: listing.town,
              postcode: listing.postcode,
              disposalType: listing.disposalType,
            }
          : null,
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
  { schema: DraftRequirementFromEnquirySchema },
);

export const LinkEnquiryRequirementSchema = z.object({
  accountId: z.string().uuid(),
  enquiryId: z.string().uuid(),
  requirementId: z.string().uuid(),
});

export const linkEnquiryToRequirement = enhanceAction(
  async (input) => {
    return createListingsService(getSupabaseServerClient()).updateEnquiry(
      input.enquiryId,
      input.accountId,
      { requirementId: input.requirementId },
    );
  },
  { schema: LinkEnquiryRequirementSchema },
);
