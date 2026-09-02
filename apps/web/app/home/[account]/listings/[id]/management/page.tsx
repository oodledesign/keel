import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { createCommercialPropertiesService } from '../../../commercial-properties/_lib/server/commercial-properties.service';
import { ListingAdvancedAttrsCard } from '../../_components/listing-advanced-attrs-card';
import { ListingAssignmentCard } from '../../_components/listing-assignment-card';
import { ListingCoAgentsCard } from '../../_components/listing-co-agents-card';
import { ListingManagementSection } from '../../_components/listing-detail-sections';
import { ListingInstructionCard } from '../../_components/listing-instruction-card';
import { ListingPartiesCard } from '../../_components/listing-parties-card';
import { ListingPrivateMediaSection } from '../../_components/listing-private-media-section';
import { ListingPropertyLinkCard } from '../../_components/listing-property-link-card';
import { MarketingReadinessCard } from '../../_components/marketing-readiness-card';
import { loadListingLinkedInCardData } from '../../_lib/server/listing-linkedin.loader';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

const SECTION_CLASS = 'scroll-mt-36 space-y-4';

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
    linkedProperty,
    linkedIn,
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
    listing.commercialPropertyId
      ? createCommercialPropertiesService(
          getSupabaseServerClient(),
        ).getProperty(listing.commercialPropertyId, accountId)
      : Promise.resolve(null),
    loadListingLinkedInCardData(accountId, listingId),
  ]);

  const [privateMediaWithUrls, publicMediaWithUrls] = await Promise.all([
    service.withSignedMediaUrls(privateMedia),
    service.withSignedMediaUrls(publicMedia),
  ]);
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
      <section id="marketing-readiness" className={SECTION_CLASS}>
        <MarketingReadinessCard
          listing={listing}
          accountSlug={slug}
          media={publicMedia}
          publications={publications}
        />
      </section>
      <section id="instruction" className={SECTION_CLASS}>
        <ListingInstructionCard accountId={accountId} listing={listing} />
      </section>
      <section id="assignment" className={SECTION_CLASS}>
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
      </section>
      <section id="co-agents" className={SECTION_CLASS}>
        <ListingCoAgentsCard
          accountId={accountId}
          listingId={listingId}
          initialCoAgents={coAgents}
        />
      </section>
      <section id="parties" className={SECTION_CLASS}>
        <ListingPropertyLinkCard
          accountId={accountId}
          accountSlug={slug}
          listingId={listingId}
          initialPropertyId={listing.commercialPropertyId}
          initialPropertyName={linkedProperty?.name ?? null}
        />
        <ListingPartiesCard
          accountId={accountId}
          accountSlug={slug}
          listingId={listingId}
          role="landlord"
          initialParties={landlords}
          listing={listing}
        />
        <ListingPartiesCard
          accountId={accountId}
          accountSlug={slug}
          listingId={listingId}
          role="other"
          initialParties={otherParties}
        />
      </section>
      <section id="advanced-attrs" className={SECTION_CLASS}>
        <ListingAdvancedAttrsCard accountId={accountId} listing={listing} />
      </section>
      <section id="private-media" className={SECTION_CLASS}>
        <ListingPrivateMediaSection
          accountId={accountId}
          listingId={listingId}
          privateImages={privateImages}
          privateFiles={privateFiles}
        />
      </section>
      <section id="publishing" className={SECTION_CLASS}>
        <ListingManagementSection
          listing={listing}
          publications={publications}
          accountId={accountId}
          accountSlug={slug}
          media={publicMediaWithUrls}
          linkedInConnection={linkedIn.connection}
          linkedInPost={linkedIn.draft}
          linkedInLastPosted={linkedIn.lastPosted}
        />
      </section>
    </div>
  );
}

export default withI18n(ListingManagementPage);
