import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingAvailabilitySection } from '../../_components/listing-detail-sections';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

async function ListingAvailabilityPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const units = await createListingsService(
    getSupabaseServerClient(),
  ).listUnits(listingId);

  return (
    <ListingAvailabilitySection
      accountId={accountId}
      listingId={listingId}
      units={units}
    />
  );
}

export default withI18n(ListingAvailabilityPage);
