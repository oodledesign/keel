import { notFound } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { ProposalEditContent } from '../../../proposals/_components/proposal-edit-content';
import { loadProposalsPageData } from '../../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../../proposals/_lib/server/server-actions';

interface SurveyEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Edit survey' };
};

async function SurveyEditPage({ params }: SurveyEditPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'proposals')) {
    notFound();
  }

  const {
    accountId,
    canViewProposals,
    canEditProposals,
    canManageProposalStatus,
    user,
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

  const kind = (proposal as { kind?: string }).kind;
  if (kind && kind !== 'survey_report') {
    notFound();
  }

  const [brand, pipeline] = await Promise.all([
    loadAccountBrandResolved(accountId),
    loadPipelineDataForAccount(accountId),
  ]);
  const title =
    (proposal as { title?: string | null }).title?.trim() || 'Building survey';
  const accountName =
    (workspace.account as { name?: string | null }).name?.trim() || accountSlug;
  const senderName =
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    user.email ||
    'Team member';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={title}
        description={<AppBreadcrumbs values={{ [id]: title }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-4 pb-[calc(5.5rem+max(1.5rem,env(safe-area-inset-bottom)))] md:px-6 md:py-6 md:pb-6">
        <ProposalEditContent
          accountSlug={accountSlug}
          accountId={accountId}
          accountName={accountName}
          senderName={senderName}
          proposal={proposal as Record<string, unknown>}
          brandLogoUrl={brand.logo_url}
          canEditProposals={canEditProposals}
          canManageProposalStatus={canManageProposalStatus}
          documentKind="survey_report"
          deals={pipeline.deals.map((d) => ({
            id: d.id,
            contactName: d.contactName,
            companyName: d.companyName,
            value: d.value,
          }))}
        />
      </PageBody>
    </>
  );
}

export default SurveyEditPage;
