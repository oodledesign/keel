import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { loadProposalsPageData } from '../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../proposals/_lib/server/server-actions';
import { SurveyHubContent } from '../_components/survey-hub-content';
import {
  SurveyGenerateDraftButton,
  SurveyWorkspaceHeader,
} from '../_components/survey-workspace-header';
import { loadSurveyDealOptions } from '../_lib/server/survey-deal-options.loader';
import { loadSurveyHubExtras } from '../_lib/server/survey-hub.loader';
import { surveyClientName } from '../_lib/survey-display';

interface SurveyHubPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Survey setup' };
};

type SurveyProposal = {
  id: string;
  title?: string | null;
  status: string;
  kind?: string | null;
  content_html?: string | null;
  recipient_name?: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  client?: {
    id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
  } | null;
  deal?: {
    id: string;
    name?: string | null;
    contact_name?: string | null;
    company_name?: string | null;
    stage?: string | null;
  } | null;
};

async function SurveyHubPage({ params }: SurveyHubPageProps) {
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

  let proposal: SurveyProposal | null;
  try {
    proposal = (await getProposal({
      accountId,
      proposalId: id,
    })) as SurveyProposal | null;
  } catch {
    notFound();
  }
  if (!proposal) notFound();
  if (proposal.kind && proposal.kind !== 'survey_report') {
    notFound();
  }

  const [extras, deals] = await Promise.all([
    loadSurveyHubExtras({
      accountId,
      proposalId: id,
      clientId: proposal.client_id,
      dealId: proposal.deal_id,
    }),
    canEditProposals ? loadSurveyDealOptions(accountId) : Promise.resolve([]),
  ]);

  const title = proposal.title?.trim() || 'Building survey';
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
      <div className="flex w-full flex-col gap-5">
        <SurveyWorkspaceHeader
          accountSlug={accountSlug}
          proposalId={id}
          title={title}
          clientName={surveyClientName(proposal)}
          status={proposal.status}
          actions={
            canEditProposals ? (
              <SurveyGenerateDraftButton
                accountSlug={accountSlug}
                accountId={accountId}
                proposalId={id}
                accountName={accountName}
                surveyorName={senderName}
                disabled={
                  extras.observations.length === 0 &&
                  extras.transcripts.length === 0
                }
              />
            ) : null
          }
        />

        <SurveyHubContent
          accountSlug={accountSlug}
          accountId={accountId}
          canEdit={canEditProposals}
          proposal={proposal}
          observations={extras.observations}
          transcripts={extras.transcripts}
          photoShare={extras.photoShare}
          styleExampleCount={extras.styleExampleCount}
          templates={extras.templates}
          surveyTemplateId={extras.surveyTemplateId}
          attachedEpc={extras.attachedEpc}
          propertyLookup={extras.propertyLookup}
          epcConfigured={extras.epcConfigured}
          flood={extras.flood}
          surveyLevel={extras.surveyLevel}
          reportDetails={extras.reportDetails}
          coverDefaultUrl={extras.coverDefaultUrl}
          coverPhotoUrl={extras.coverPhotoUrl}
          canEditDetails={canEditProposals && extras.isDraft}
          deals={deals}
          canEditClient={canEditProposals && proposal.status === 'draft'}
        />
      </div>
    </PageBody>
  );
}

export default SurveyHubPage;
