import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingPublishingSection } from '../../_components/listing-publishing-section';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => ({ title: 'Publishing' });

async function ListingPublishingPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const [publications, media] = await Promise.all([
    service.listPublicationsForListing(listingId),
    service.listMedia(listingId, { privacy: 'public' }),
  ]);

  const mediaWithUrls = await service.withSignedMediaUrls(media);

  return (
    <ListingPublishingSection
      listing={listing}
      publications={publications}
      accountId={accountId}
      accountSlug={slug}
      media={mediaWithUrls}
    />
  );
}

export default withI18n(ListingPublishingPage);
