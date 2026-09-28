import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { loadProposalsPageData } from '../../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../../proposals/_lib/server/server-actions';
import { SurveyReportBuilder } from '../../_components/survey-report-builder';
import { loadSurveyDealOptions } from '../../_lib/server/survey-deal-options.loader';

interface SurveyEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Report builder' };
};

async function SurveyEditPage({ params }: SurveyEditPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'proposals')) {
    notFound();
  }

  const { accountId, canViewProposals, canEditProposals, user } =
    await loadProposalsPageData(accountSlug);

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

  const deals = await loadSurveyDealOptions(accountId);
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
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-4 pb-[calc(5.5rem+max(1.5rem,env(safe-area-inset-bottom)))] md:px-6 md:py-6 md:pb-6">
      <SurveyReportBuilder
        accountSlug={accountSlug}
        accountId={accountId}
        accountName={accountName}
        senderName={senderName}
        proposal={proposal as Record<string, unknown>}
        canEdit={canEditProposals}
        deals={deals}
      />
    </PageBody>
  );
}

export default SurveyEditPage;
