import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { LISTING_URL_TEMPLATE_META_KEY } from '~/lib/commercial/listing-website-url';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingPublishingSection } from '../../_components/listing-publishing-section';
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

async function ListingPublishingPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const service = createListingsService(client);
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const [publications, media, listingUrlTemplate] = await Promise.all([
    service.listPublicationsForListing(listingId),
    service.listMedia(listingId, { privacy: 'public' }),
    loadListingUrlTemplate(client as unknown as SupabaseClient, accountId),
  ]);

  const mediaWithUrls = await service.withSignedMediaUrls(media);

  return (
    <ListingPublishingSection
      listing={listing}
      publications={publications}
      accountId={accountId}
      accountSlug={slug}
      media={mediaWithUrls}
      listingUrlTemplate={listingUrlTemplate}
    />
  );
}

export default withI18n(ListingPublishingPage);
