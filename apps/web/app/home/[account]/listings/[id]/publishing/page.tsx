import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { BrochureStatusRecord } from '~/lib/commercial/brochure-pdf/brochure-status';
import { getWebsiteChannelStatus } from '~/lib/commercial/channel-publish-status';
import { LISTING_URL_TEMPLATE_META_KEY } from '~/lib/commercial/listing-website-url';
import { loadWebsiteChannelUrlState } from '~/lib/commercial/listing-website-url-resolve.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingPublishingSection } from '../../_components/listing-publishing-section';
import { createListingBrochureService } from '../../_lib/server/listing-brochure.service';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => ({ title: 'Publishing' });

async function loadListingUrlTemplate(
  client: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const { data } = await client
    .from('commercial_portal_credentials')
    .select('metadata')
    .eq('account_id', accountId)
    .eq('portal', 'property_hive')
    .maybeSingle();
  const meta = (data?.metadata ?? {}) as Record<string, unknown>;
  const template = meta[LISTING_URL_TEMPLATE_META_KEY];
  return typeof template === 'string' && template.trim()
    ? template.trim()
    : null;
}

async function loadBrochureStatusRecords(
  client: SupabaseClient,
  listingId: string,
  accountId: string,
): Promise<BrochureStatusRecord[]> {
  try {
    const docs = await createListingBrochureService(client).listDocuments(
      listingId,
      accountId,
    );
    const approverIds = [
      ...new Set(
        docs.map((d) => d.approvedBy).filter((id): id is string => !!id),
      ),
    ];
    const names = new Map<string, string>();
    if (approverIds.length > 0) {
      // Approvers are workspace members whose personal accounts RLS may hide;
      // the ids come from brochure rows already scoped to this workspace.
      const { data } = await getSupabaseServerAdminClient()
        .from('accounts')
        .select('id, name')
        .in('id', approverIds);
      for (const row of data ?? []) {
        if (row.name?.trim()) names.set(row.id, row.name.trim());
      }
    }
    return docs.map((d) => ({
      orientation: d.orientation,
      updatedAt: d.updatedAt ?? null,
      approvedAt: d.approvedAt,
      approvedByName: d.approvedBy ? (names.get(d.approvedBy) ?? null) : null,
      publishedMediaId: d.publishedMediaId,
    }));
  } catch (err) {
    console.error(
      '[publishing] brochure status load failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function ListingPublishingPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const service = createListingsService(client);
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const [publications, media, listingUrlTemplate, brochureRecords] =
    await Promise.all([
      service.listPublicationsForListing(listingId),
      service.listMedia(listingId, { privacy: 'public' }),
      loadListingUrlTemplate(client as unknown as SupabaseClient, accountId),
      loadBrochureStatusRecords(
        client as unknown as SupabaseClient,
        listingId,
        accountId,
      ),
    ]);

  const websiteIsLive =
    getWebsiteChannelStatus({
      listing: {
        status: listing.status,
        externalId: listing.externalId,
        websiteUrl: listing.websiteUrl,
      },
      publications,
    }).state === 'live';

  const [websiteUrlState, mediaWithUrls] = await Promise.all([
    loadWebsiteChannelUrlState({
      accountId,
      listingId,
      listing: {
        externalId: listing.externalId,
        addressLine1: listing.addressLine1,
        addressLine2: listing.addressLine2,
        town: listing.town,
        postcode: listing.postcode,
        name: listing.name,
        websiteUrl: listing.websiteUrl,
      },
      publications,
      listingUrlTemplate,
      websiteIsLive,
    }),
    service.withSignedMediaUrls(media),
  ]);

  return (
    <ListingPublishingSection
      listing={listing}
      publications={publications}
      accountId={accountId}
      accountSlug={slug}
      media={mediaWithUrls}
      brochureRecords={brochureRecords}
      websitePublicPageUrl={websiteUrlState.publicPageUrl}
      websiteUrlHealth={websiteUrlState.health}
    />
  );
}

export default withI18n(ListingPublishingPage);
