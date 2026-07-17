import { notFound } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { ProposalEditContent } from '../../_components/proposal-edit-content';
import { loadProposalsPageData } from '../../_lib/server/proposals-page.loader';
import { getProposal } from '../../_lib/server/server-actions';

interface ProposalEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string; id: string }>;
}) => {
  const { id } = await params;
  return { title: `Edit proposal` };
};

async function ProposalEditPage({ params }: ProposalEditPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'invoices')) {
    notFound();
  }

  const {
    accountId,
    canViewProposals,
    canEditProposals,
    canManageProposalStatus,
  } = await loadProposalsPageData(accountSlug);

  if (!id) notFound();
  if (!canViewProposals) notFound();

  let proposal: Awaited<ReturnType<typeof getProposal>>;
  try {
    proposal = await getProposal({ accountId, proposalId: id });
  } catch {
    notFound();
  }
  if (!proposal) notFound();

  const brand = await loadAccountBrandResolved(accountId);
  const title =
    (proposal as { title?: string | null }).title?.trim() || 'Proposal';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={title}
        description={<AppBreadcrumbs values={{ [id]: title }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <ProposalEditContent
          accountSlug={accountSlug}
          accountId={accountId}
          proposal={proposal as Record<string, unknown>}
          brandLogoUrl={brand.logo_url}
          canEditProposals={canEditProposals}
          canManageProposalStatus={canManageProposalStatus}
        />
      </PageBody>
    </>
  );
}

export default ProposalEditPage;
