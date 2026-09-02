import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { MAX_LINKEDIN_IMAGES } from '~/lib/commercial/linkedin-publishing/constants';
import { downloadListingImageBytes } from '~/lib/commercial/linkedin-publishing/download-listing-image';
import {
  LinkedInApiError,
  buildLinkedInCreatePostPayload,
  createLinkedInOrganizationPost,
  initializeLinkedInImageUpload,
  organizationUrn,
  uploadLinkedInImageBinary,
} from '~/lib/commercial/linkedin-publishing/linkedin-api';
import {
  type OverlayListing,
  buildOverlaySpec,
} from '~/lib/commercial/linkedin-publishing/overlay';
import {
  composeLinkedInOverlayJpeg,
  cropLinkedInLandscapeJpeg,
} from '~/lib/commercial/linkedin-publishing/overlay-image';

export type PublishableListingImage = {
  id: string;
  storagePath: string | null;
  externalUrl: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function publishListingToLinkedInOrg(input: {
  client: SupabaseClient;
  accessToken: string;
  organizationUrn: string;
  commentary: string;
  images: PublishableListingImage[];
  overlayFirst: boolean;
  overlayListing: OverlayListing;
}): Promise<string> {
  const author = organizationUrn(input.organizationUrn);
  const selected = input.images.slice(0, MAX_LINKEDIN_IMAGES);
  const imageUrns: string[] = [];
  const altTexts: string[] = [];

  for (let index = 0; index < selected.length; index += 1) {
    const item = selected[index]!;
    const { bytes } = await downloadListingImageBytes(input.client, item);
    const overlay =
      index === 0 && input.overlayFirst
        ? await composeLinkedInOverlayJpeg(
            bytes,
            buildOverlaySpec(input.overlayListing, true),
          )
        : selected.length === 1
          ? await cropLinkedInLandscapeJpeg(bytes)
          : bytes;

    const { uploadUrl, imageUrn } = await initializeLinkedInImageUpload(
      input.accessToken,
      author,
    );
    await uploadLinkedInImageBinary(uploadUrl, overlay, 'image/jpeg');
    imageUrns.push(imageUrn);
    altTexts.push(
      item.fileName ?? input.overlayListing.town ?? 'Property photo',
    );
  }

  const payload = buildLinkedInCreatePostPayload({
    organizationUrn: author,
    commentary: input.commentary,
    imageUrns,
    imageAltTexts: altTexts,
  });

  try {
    return await createLinkedInOrganizationPost(input.accessToken, payload);
  } catch (error) {
    if (error instanceof LinkedInApiError) {
      throw error;
    }
    throw error;
  }
}
