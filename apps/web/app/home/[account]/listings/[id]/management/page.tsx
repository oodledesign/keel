import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingAssignmentCard } from '../../_components/listing-assignment-card';
import { ListingManagementSection } from '../../_components/listing-detail-sections';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

async function ListingManagementPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const [publications, members, teams, assignment] = await Promise.all([
    service.listPublicationsForListing(listingId),
    service.listAccountMembers(slug),
    service.listWorkspaceTeams(accountId),
    service.getListingAssignment(listingId, accountId, slug),
  ]);

  return (
    <div className="space-y-4">
      <ListingAssignmentCard
        accountId={accountId}
        accountSlug={slug}
        members={members}
        teams={teams}
        assignment={assignment}
      />
      <ListingManagementSection
        listing={listing}
        publications={publications}
        accountId={accountId}
      />
    </div>
  );
}

export default withI18n(ListingManagementPage);
