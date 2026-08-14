import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingMarketingEditor } from '../../_components/listing-marketing-editor';
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

  const [publications, members, assignment, coAgents, teams, branches, media] =
    await Promise.all([
      service.listPublicationsForListing(listingId),
      service.listAccountMembers(slug),
      service.getListingAssignment(listingId, accountId, slug),
      service.listCoAgents(listingId, accountId),
      service.listWorkspaceTeams(accountId),
      loadAccountBranches(accountId),
      service.listMedia(listingId),
    ]);

  return (
    <ListingMarketingEditor
      listing={listing}
      accountId={accountId}
      accountSlug={slug}
      members={members}
      teams={teams}
      branches={branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        rightmoveBranchId: branch.rightmoveBranchId,
      }))}
      assignment={assignment}
      coAgents={coAgents}
      publications={publications}
      media={media}
    />
  );
}

export default withI18n(ListingMarketingPage);
