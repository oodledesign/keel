import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { getCachedDisposalDetail } from '~/lib/cache/disposals-data-cache';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingDisposalFormPage } from '../../_components/listing-disposal-form-page';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
  searchParams: Promise<{
    dealId?: string;
    sopAssist?: string;
  }>;
}

async function EditDisposalPage({ params, searchParams }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const user = await requireUserInServerComponent();

  const listing = await getCachedDisposalDetail({
    accountId,
    userId: user.id,
    listingId,
  });

  if (!listing) {
    notFound();
  }

  if (!workspace.canMutateCommercial) {
    redirect(
      pathsConfig.app.accountListingDetail
        .replace('[account]', slug)
        .replace('[id]', listingId),
    );
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={listing.name || 'New disposal'}
        description="Draft — changes save automatically"
      />
      <PageBody className="px-4 pb-10 lg:px-6">
        <ListingDisposalFormPage
          listing={listing}
          accountId={accountId}
          accountSlug={slug}
          sopAssistRunId={query.sopAssist?.trim() || null}
          pipelineDealId={query.dealId?.trim() || null}
        />
      </PageBody>
    </>
  );
}

export default withI18n(EditDisposalPage);
