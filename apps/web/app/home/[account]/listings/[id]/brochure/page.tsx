import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { BrochureWizardPage } from '../../_components/brochure-wizard/brochure-wizard-page';
import { listingBrochureChannels } from '../../_lib/listing-channel-statuses';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
  searchParams: Promise<{ orientation?: string }>;
}

export const generateMetadata = async () => ({ title: 'Brochure' });

async function ListingBrochurePage({ params, searchParams }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const sp = await searchParams;
  const orientation = sp.orientation === 'portrait' ? 'portrait' : 'landscape';

  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  await requireCommercialBillableActor(accountId, 'create or edit disposals');

  const listings = createListingsService(getSupabaseServerClient());
  const listing = await listings.getListing(listingId, accountId);
  if (!listing) notFound();

  const [publications, media] = await Promise.all([
    listings.listPublicationsForListing(listingId),
    listings.listMedia(listingId, { privacy: 'public' }),
  ]);

  const publishingHref = `${pathsConfig.app.accountListingDetail
    .replace('[account]', slug)
    .replace('[id]', listingId)}/publishing`;

  return (
    <BrochureWizardPage
      returnHref={publishingHref}
      listingId={listingId}
      accountId={accountId}
      listingName={listing.name}
      initialOrientation={orientation}
      defaultShowRent={!listing.hideRentFromMarketing}
      defaultShowPrice={!listing.hidePriceFromMarketing}
      channels={listingBrochureChannels({ listing, publications, media })}
    />
  );
}

export default withI18n(ListingBrochurePage);
