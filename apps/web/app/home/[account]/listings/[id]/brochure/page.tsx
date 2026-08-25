import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingBrochureEditor } from '../../_components/listing-brochure-editor';
import { createListingBrochureService } from '../../_lib/server/listing-brochure.service';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
  searchParams: Promise<{ orientation?: string }>;
}

async function ListingBrochureEditorPage({ params, searchParams }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const sp = await searchParams;
  const orientation = sp.orientation === 'landscape' ? 'landscape' : 'portrait';

  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  await requireCommercialBillableActor(accountId, 'create or edit disposals');

  const client = getSupabaseServerClient();
  const listings = createListingsService(client);
  const listing = await listings.getListing(listingId, accountId);
  if (!listing) notFound();

  const brochureService = createListingBrochureService(client);
  const document = await brochureService.getOrCreateDocument({
    listingId,
    accountId,
    orientation,
    templateId: 'classic',
  });

  const brochureData = await loadListingBrochureData(listingId, accountId);

  return (
    <ListingBrochureEditor
      listingId={listingId}
      accountId={accountId}
      accountSlug={slug}
      listingName={listing.name}
      accountName={brochureData?.accountName ?? workspace.account.name ?? ''}
      brand={
        brochureData?.brand ?? {
          logoUrl: null,
          primaryColor: '#351E28',
          secondaryColor: '#41606F',
          accentColor: '#FF5C34',
        }
      }
      initialDocument={document}
      images={brochureData?.images ?? []}
    />
  );
}

export default withI18n(ListingBrochureEditorPage);
