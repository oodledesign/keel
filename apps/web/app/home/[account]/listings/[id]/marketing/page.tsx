import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingMarketingEditor } from '../../_components/listing-marketing-editor';
import { ListingPublishingHashRedirect } from '../../_components/listing-publishing-hash-redirect';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

async function ListingMarketingPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const [publications, media] = await Promise.all([
    service.listPublicationsForListing(listingId),
    service.listMedia(listingId),
  ]);

  const mediaWithUrls = await service.withSignedMediaUrls(media);
  const listingBase = pathsConfig.app.accountListingDetail
    .replace('[account]', slug)
    .replace('[id]', listingId);

  return (
    <>
      <ListingPublishingHashRedirect
        publishingHref={`${listingBase}/publishing`}
        managementHref={`${listingBase}/management`}
      />
      <ListingMarketingEditor
        listing={listing}
        accountId={accountId}
        accountSlug={slug}
        publications={publications}
        media={mediaWithUrls}
      />
    </>
  );
}

export default withI18n(ListingMarketingPage);
