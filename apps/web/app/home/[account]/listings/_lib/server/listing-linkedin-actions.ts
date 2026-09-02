'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { INSUFFICIENT_AI_CREDITS_CODE } from '~/lib/ai/ai-credits-exhausted';
import { isInsufficientCreditsError } from '~/lib/ai/router';
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import { generateLinkedInListingPost } from '~/lib/commercial/linkedin-publishing/ai-linkedin-post';
import {
  findEditableLinkedInPost,
  loadLastPostedListingLinkedIn,
  loadLatestListingLinkedInPost,
  markLinkedInConnectionNeedsReconnect,
  resolveLinkedInAccessToken,
} from '~/lib/commercial/linkedin-publishing/connections';
import { MAX_LINKEDIN_IMAGES } from '~/lib/commercial/linkedin-publishing/constants';
import { downloadListingImageBytes } from '~/lib/commercial/linkedin-publishing/download-listing-image';
import { LinkedInApiError } from '~/lib/commercial/linkedin-publishing/linkedin-api';
import { resolveListingPublicUrl } from '~/lib/commercial/linkedin-publishing/listing-public-url';
import { buildOverlaySpec } from '~/lib/commercial/linkedin-publishing/overlay';
import { composeLinkedInOverlayJpeg } from '~/lib/commercial/linkedin-publishing/overlay-image';
import {
  appendListingUrl,
  buildDescriptionSourceCopy,
  clampHashtags,
} from '~/lib/commercial/linkedin-publishing/post-copy';
import { publishListingToLinkedInOrg } from '~/lib/commercial/linkedin-publishing/publish-post';

import {
  GenerateLinkedInPostSchema,
  PostListingToLinkedInSchema,
  PreviewLinkedInOverlaySchema,
  SaveListingLinkedInDraftSchema,
  ScheduleListingLinkedInSchema,
} from '../schema/listing-linkedin.schema';
import { createListingsService } from './listings.service';

function db() {
  return getSupabaseServerClient();
}

function overlayListingFrom(listing: {
  status: string;
  disposalType: string;
  town: string | null;
  askingRentPence: number | null;
  askingRentToPence: number | null;
  askingPricePence: number | null;
  rentFrequency: string | null;
  hideRentFromMarketing: boolean;
  hidePriceFromMarketing: boolean;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
}) {
  return {
    status: listing.status,
    disposalType: listing.disposalType,
    town: listing.town,
    askingRentPence: listing.askingRentPence,
    askingRentToPence: listing.askingRentToPence,
    askingPricePence: listing.askingPricePence,
    rentFrequency: listing.rentFrequency,
    hideRentFromMarketing: listing.hideRentFromMarketing,
    hidePriceFromMarketing: listing.hidePriceFromMarketing,
    sizeMinSqft: listing.sizeMinSqft,
    sizeMaxSqft: listing.sizeMaxSqft,
  };
}

function resolveUrlForListing(
  listing: {
    websiteUrl: string | null;
    brochureShareEnabled: boolean;
    brochureShareToken: string | null;
  },
  publications: Array<{
    portal: string;
    status: string;
    externalUrl: string | null;
  }>,
) {
  return resolveListingPublicUrl({
    websiteUrl: listing.websiteUrl,
    brochureShareEnabled: listing.brochureShareEnabled,
    brochureShareToken: listing.brochureShareToken,
    publications,
    appOrigin: getAppSiteOrigin(),
  });
}

async function persistPost(input: {
  accountId: string;
  listingId: string;
  postId?: string;
  body: string;
  imageMediaIds: string[];
  overlayFirst: boolean;
  listingUrl?: string | null;
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  scheduledAt?: string | null;
  postedAt?: string | null;
  linkedinPostUrn?: string | null;
  error?: string | null;
  createdBy?: string;
}) {
  const client = db();
  const listingUrl = input.listingUrl?.trim() || null;
  const imageMediaIds = input.imageMediaIds.slice(0, MAX_LINKEDIN_IMAGES);
  const body = appendListingUrl(clampHashtags(input.body), listingUrl);

  const latest = await loadLatestListingLinkedInPost(
    client,
    input.accountId,
    input.listingId,
  );
  const editable = input.postId
    ? latest?.id === input.postId
      ? latest
      : null
    : findEditableLinkedInPost(latest);

  const row = {
    account_id: input.accountId,
    listing_id: input.listingId,
    body,
    image_media_ids: imageMediaIds,
    overlay_first: input.overlayFirst,
    listing_url: listingUrl,
    status: input.status,
    scheduled_at: input.scheduledAt ?? null,
    posted_at: input.postedAt ?? null,
    linkedin_post_urn: input.linkedinPostUrn ?? null,
    error: input.error ?? null,
    created_by: input.createdBy ?? null,
  };

  if (editable) {
    const { data, error } = await client
      .from('listing_linkedin_posts')
      .update(row)
      .eq('id', editable.id)
      .eq('account_id', input.accountId)
      .select(
        'id, account_id, listing_id, body, image_media_ids, overlay_first, listing_url, status, scheduled_at, posted_at, linkedin_post_urn, error, updated_at',
      )
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await client
    .from('listing_linkedin_posts')
    .insert(row)
    .select(
      'id, account_id, listing_id, body, image_media_ids, overlay_first, listing_url, status, scheduled_at, posted_at, linkedin_post_urn, error, updated_at',
    )
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadListingImages(
  listingId: string,
  accountId: string,
  imageMediaIds: string[],
) {
  const service = createListingsService(db());
  const media = await service.withSignedMediaUrls(
    await service.listMedia(listingId, { privacy: 'public', accountId }),
  );
  const images = media.filter(
    (item) =>
      item.mediaType === 'image' ||
      Boolean(item.mimeType?.startsWith('image/')),
  );
  const selected = imageMediaIds
    .map((id) => images.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return { images, selected };
}

export const generateLinkedInPostCopyAction = enhanceAction(
  async (input) => {
    const client = db();
    const service = createListingsService(client);
    const listing = await service.getListing(input.listingId, input.accountId);
    if (!listing) throw new Error('Listing not found');
    const publications = await service.listPublicationsForListing(
      input.listingId,
    );
    const publicUrl = resolveUrlForListing(listing, publications);

    try {
      const body = await generateLinkedInListingPost({
        accountId: input.accountId,
        supabase: client,
        listing: {
          name: listing.name,
          addressLine1: listing.addressLine1,
          addressLine2: listing.addressLine2,
          town: listing.town,
          county: listing.county,
          postcode: listing.postcode,
          disposalType: listing.disposalType,
          tenure: listing.tenure,
          useClass: listing.useClass,
          askingRentPence: listing.askingRentPence,
          askingRentToPence: listing.askingRentToPence,
          askingPricePence: listing.askingPricePence,
          rentFrequency: listing.rentFrequency,
          hideRentFromMarketing: listing.hideRentFromMarketing,
          hidePriceFromMarketing: listing.hidePriceFromMarketing,
          sizeMinSqft: listing.sizeMinSqft,
          sizeMaxSqft: listing.sizeMaxSqft,
          summary: listing.summary,
          description: listing.description,
          keyPoints: listing.keyPoints,
          sector: listing.sector,
        },
        listingUrl: publicUrl.url,
      });
      return { body, listingUrl: publicUrl };
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        throw new Error(
          `Not enough AI credits (need ${error.creditsRequired}, have ${error.creditsRemaining}). [${INSUFFICIENT_AI_CREDITS_CODE}]`,
        );
      }
      throw error;
    }
  },
  { schema: GenerateLinkedInPostSchema },
);

export const applyListingDescriptionToLinkedInAction = enhanceAction(
  async (input) => {
    const client = db();
    const service = createListingsService(client);
    const listing = await service.getListing(input.listingId, input.accountId);
    if (!listing) throw new Error('Listing not found');
    const publications = await service.listPublicationsForListing(
      input.listingId,
    );
    const publicUrl = resolveUrlForListing(listing, publications);
    return {
      body: buildDescriptionSourceCopy({
        summary: listing.summary,
        description: listing.description,
        listingUrl: publicUrl.url,
      }),
      listingUrl: publicUrl,
    };
  },
  { schema: GenerateLinkedInPostSchema },
);

export const saveListingLinkedInDraftAction = enhanceAction(
  async (input, user) => {
    const row = await persistPost({
      ...input,
      status: 'draft',
      scheduledAt: null,
      createdBy: user.id,
    });
    revalidatePath('/home/[account]/listings/[id]/marketing');
    return row;
  },
  { schema: SaveListingLinkedInDraftSchema },
);

export const scheduleListingLinkedInAction = enhanceAction(
  async (input, user) => {
    const scheduled = new Date(input.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      throw new Error('Choose a valid date and time');
    }
    if (scheduled.getTime() <= Date.now() - 30_000) {
      throw new Error('Schedule a time in the future (Europe/London)');
    }

    const row = await persistPost({
      ...input,
      status: 'scheduled',
      scheduledAt: scheduled.toISOString(),
      error: null,
      createdBy: user.id,
    });
    revalidatePath('/home/[account]/listings/[id]/marketing');
    return row;
  },
  { schema: ScheduleListingLinkedInSchema },
);

export const postListingToLinkedInNowAction = enhanceAction(
  async (input, user) => {
    const client = db();
    const service = createListingsService(client);
    const listing = await service.getListing(input.listingId, input.accountId);
    if (!listing) throw new Error('Listing not found');

    const publications = await service.listPublicationsForListing(
      input.listingId,
    );
    const publicUrl = resolveUrlForListing(listing, publications);
    const listingUrl = input.listingUrl ?? publicUrl.url;
    const body = appendListingUrl(clampHashtags(input.body), listingUrl);
    if (!body.trim()) {
      throw new Error('Write or generate post copy before publishing');
    }

    const { selected } = await loadListingImages(
      input.listingId,
      input.accountId,
      input.imageMediaIds,
    );

    const draft = await persistPost({
      ...input,
      body,
      listingUrl,
      status: 'posting',
      scheduledAt: null,
      error: null,
      createdBy: user.id,
    });

    try {
      const tokens = await resolveLinkedInAccessToken(client, input.accountId);
      const urn = await publishListingToLinkedInOrg({
        client,
        accessToken: tokens.accessToken,
        organizationUrn: tokens.orgUrn,
        commentary: body,
        images: selected,
        overlayFirst: input.overlayFirst,
        overlayListing: overlayListingFrom(listing),
      });

      const { data, error } = await client
        .from('listing_linkedin_posts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          linkedin_post_urn: urn,
          error: null,
          listing_url: listingUrl,
          body,
        })
        .eq('id', (draft as { id: string }).id)
        .select(
          'id, account_id, listing_id, body, image_media_ids, overlay_first, listing_url, status, scheduled_at, posted_at, linkedin_post_urn, error, updated_at',
        )
        .single();
      if (error) throw new Error(error.message);
      revalidatePath('/home/[account]/listings/[id]/marketing');
      return data;
    } catch (error) {
      if (error instanceof LinkedInApiError && error.reconnect) {
        await markLinkedInConnectionNeedsReconnect(client, input.accountId);
      }
      const message =
        error instanceof Error ? error.message : 'LinkedIn post failed';
      await client
        .from('listing_linkedin_posts')
        .update({ status: 'failed', error: message })
        .eq('id', (draft as { id: string }).id);
      throw new Error(message);
    }
  },
  { schema: PostListingToLinkedInSchema },
);

export const previewLinkedInOverlayAction = enhanceAction(
  async (input) => {
    const client = db();
    const service = createListingsService(client);
    const listing = await service.getListing(input.listingId, input.accountId);
    if (!listing) throw new Error('Listing not found');
    const { selected } = await loadListingImages(
      input.listingId,
      input.accountId,
      [input.mediaId],
    );
    const image = selected[0];
    if (!image) throw new Error('Choose a listing photo');
    const { bytes } = await downloadListingImageBytes(client, image);
    const jpeg = await composeLinkedInOverlayJpeg(
      bytes,
      buildOverlaySpec(overlayListingFrom(listing), true),
    );
    return { dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}` };
  },
  { schema: PreviewLinkedInOverlaySchema },
);

export const loadListingLinkedInStateAction = enhanceAction(
  async (input) => {
    const client = db();
    const latest = await loadLatestListingLinkedInPost(
      client,
      input.accountId,
      input.listingId,
    );
    const lastPosted = await loadLastPostedListingLinkedIn(
      client,
      input.accountId,
      input.listingId,
    );
    return { latest, lastPosted };
  },
  { schema: GenerateLinkedInPostSchema },
);
