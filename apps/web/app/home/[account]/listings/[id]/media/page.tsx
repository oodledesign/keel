import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
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

  const [publicMedia, privateMedia] = await Promise.all([
    service.listMedia(listingId),
    service.listMedia(listingId, { privacy: 'private' }),
  ]);
  const [media, privateMediaWithUrls] = await Promise.all([
    service.withSignedMediaUrls(publicMedia),
    service.withSignedMediaUrls(privateMedia),
  ]);
  const privateImages = privateMediaWithUrls.filter(
    (item) =>
      item.mediaType === 'image' ||
      Boolean(item.mimeType?.startsWith('image/')),
  );

  return (
    <ListingMediaPageSection
      accountId={accountId}
      listingId={listingId}
      media={media}
      privateImages={privateImages}
      websiteUrl={listing.websiteUrl}
      managePrivateMediaHref={`${pathsConfig.app.accountListingDetail
        .replace('[account]', slug)
        .replace('[id]', listingId)}/management#private-media`}
    />
  );
}

export default withI18n(ListingMediaPage);
