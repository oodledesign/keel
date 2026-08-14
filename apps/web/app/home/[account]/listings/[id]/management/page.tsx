import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingAdvancedAttrsCard } from '../../_components/listing-advanced-attrs-card';
import { ListingAssignmentCard } from '../../_components/listing-assignment-card';
import { ListingCoAgentsCard } from '../../_components/listing-co-agents-card';
import { ListingManagementSection } from '../../_components/listing-detail-sections';
import { ListingInstructionCard } from '../../_components/listing-instruction-card';
import { ListingPartiesCard } from '../../_components/listing-parties-card';
import { ListingPrivateMediaSection } from '../../_components/listing-private-media-section';
import { MarketingReadinessCard } from '../../_components/marketing-readiness-card';
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

  const [
    publications,
    members,
    assignment,
    coAgents,
    teams,
    branches,
    privateMedia,
    publicMedia,
    landlords,
    otherParties,
  ] = await Promise.all([
    service.listPublicationsForListing(listingId),
    service.listAccountMembers(slug),
    service.getListingAssignment(listingId, accountId, slug),
    service.listCoAgents(listingId, accountId),
    service.listWorkspaceTeams(accountId),
    loadAccountBranches(accountId),
    service.listMedia(listingId, { privacy: 'private' }),
    service.listMedia(listingId, { privacy: 'public' }),
    service.listParties(listingId, accountId, 'landlord'),
    service.listParties(listingId, accountId, 'other'),
  ]);

  const privateMediaWithUrls = await service.withSignedMediaUrls(privateMedia);
  const privateImages = privateMediaWithUrls.filter(
    (item) =>
      item.mediaType === 'image' ||
      Boolean(item.mimeType?.startsWith('image/')),
  );
  const privateFiles = privateMediaWithUrls.filter(
    (item) =>
      item.mediaType !== 'image' && !item.mimeType?.startsWith('image/'),
  );

  return (
    <div className="space-y-4">
      <MarketingReadinessCard
        listing={listing}
        accountSlug={slug}
        media={publicMedia}
        publications={publications}
      />
      <ListingInstructionCard accountId={accountId} listing={listing} />
      <ListingAssignmentCard
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
      />
      <ListingCoAgentsCard
        accountId={accountId}
        listingId={listingId}
        initialCoAgents={coAgents}
      />
      <ListingPartiesCard
        accountId={accountId}
        listingId={listingId}
        role="landlord"
        initialParties={landlords}
        listing={listing}
      />
      <ListingPartiesCard
        accountId={accountId}
        listingId={listingId}
        role="other"
        initialParties={otherParties}
      />
      <ListingAdvancedAttrsCard accountId={accountId} listing={listing} />
      <ListingPrivateMediaSection
        accountId={accountId}
        listingId={listingId}
        privateImages={privateImages}
        privateFiles={privateFiles}
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
