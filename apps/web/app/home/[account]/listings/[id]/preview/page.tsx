import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingPublicPreview } from '../../_components/listing-public-preview';
import { buildListingPreviewExternalLinks } from '../../_lib/listing-preview-links';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id: listingId } = await params;
  return {
    title: `Preview · Disposal`,
    description: `Staff marketing preview for disposal ${listingId}`,
  };
}

async function ListingPublicPreviewPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id;
  if (!accountId) {
    notFound();
  }

  const service = createListingsService(getSupabaseServerClient());

  const [listing, brochure, units, publications] = await Promise.all([
    service.getListing(listingId, accountId),
    loadListingBrochureData(listingId, accountId),
    service.listUnits(listingId),
    service.listPublicationsForListing(listingId),
  ]);

  if (!listing || !brochure || listing.accountId !== accountId) {
    notFound();
  }

  const scopedUnits = units.filter((unit) => unit.accountId === accountId);
  const scopedPublications = publications.filter(
    (publication) => publication.accountId === accountId,
  );

  const backHref = `/home/${slug}/listings/${listingId}`;
  const externalLinks = buildListingPreviewExternalLinks({
    brochureShareEnabled: listing.brochureShareEnabled,
    brochureShareToken: listing.brochureShareToken,
    websiteUrl: listing.websiteUrl,
    publications: scopedPublications,
  });

  return (
    <ListingPublicPreview
      data={brochure}
      sector={listing.sector}
      units={scopedUnits.map((unit) => ({
        id: unit.id,
        label: unit.label,
        floorOrUnit: unit.floorOrUnit,
        sizeSqft: unit.sizeSqft,
        askingRentPence: unit.askingRentPence,
        status: unit.status,
      }))}
      externalLinks={externalLinks}
      backHref={backHref}
    />
  );
}

export default withI18n(ListingPublicPreviewPage);
