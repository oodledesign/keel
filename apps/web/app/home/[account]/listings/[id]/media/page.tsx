import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingMediaPageSection } from '../../_components/listing-detail-sections';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

async function ListingMediaPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const media = await service.withSignedMediaUrls(
    await service.listMedia(listingId),
  );

  return (
    <ListingMediaPageSection
      accountId={accountId}
      listingId={listingId}
      media={media}
      websiteUrl={listing.websiteUrl}
    />
  );
}

export default withI18n(ListingMediaPage);
