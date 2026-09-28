import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import {
  deskReviewSectionByKey,
  deskReviewSections,
} from '~/lib/building-surveyor/survey-desk-review';

import { isWorkModuleEnabled } from '../../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';
import { loadProposalsPageData } from '../../../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../../../proposals/_lib/server/server-actions';
import { SurveyDeskReviewClient } from '../../../_components/survey-desk-review-client';
import {
  SurveyGenerateDraftButton,
  SurveyWorkspaceHeader,
} from '../../../_components/survey-workspace-header';
import { loadSurveyHubExtras } from '../../../_lib/server/survey-hub.loader';
import { surveyClientName, surveyPath } from '../../../_lib/survey-display';

interface ContentReviewSectionPageProps {
  params: Promise<{ account: string; id: string; sectionKey: string }>;
}

type SurveyProposal = {
  title?: string | null;
  status: string;
  kind?: string | null;
  recipient_name?: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  client?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  deal?: { contact_name?: string | null } | null;
};

export const generateMetadata = async ({
  params,
}: ContentReviewSectionPageProps) => {
  const { sectionKey } = await params;
  const section = deskReviewSectionByKey(sectionKey);
  return {
    title: section ? `${section.ricsCode} content review` : 'Content review',
  };
};

async function ContentReviewSectionPage({
  params,
}: ContentReviewSectionPageProps) {
  const { account: accountSlug, id, sectionKey } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'proposals')) {
    notFound();
  }

  const { accountId, canViewProposals, canEditProposals, user } =
    await loadProposalsPageData(accountSlug);
  if (!id || !canViewProposals) notFound();

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
  if (proposal.kind && proposal.kind !== 'survey_report') notFound();

  const extras = await loadSurveyHubExtras({
    accountId,
    proposalId: id,
    clientId: proposal.client_id,
    dealId: proposal.deal_id,
  });

  const photoCountByKey = new Map<string, number>();
  for (const photo of extras.pinnedPhotos) {
    photoCountByKey.set(
      photo.sectionKey,
      (photoCountByKey.get(photo.sectionKey) ?? 0) + 1,
    );
  }

  const sections = deskReviewSections(extras.surveyLevel, {
    noteKeys: extras.observations.map((item) => item.sectionKey),
    photoCountByKey,
  });

  if (!sections.some((item) => item.key === sectionKey)) {
    const fallback = sections[0]?.key;
    if (fallback) {
      redirect(
        surveyPath(
          pathsConfig.app.accountSurveyReviewSection,
          accountSlug,
          id,
          fallback,
        ),
      );
    }
    notFound();
  }

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

        <SurveyDeskReviewClient
          accountSlug={accountSlug}
          accountId={accountId}
          proposalId={id}
          canEdit={canEditProposals}
          clientId={proposal.client_id}
          sections={sections}
          currentKey={sectionKey}
          observations={extras.observations}
          phraseBankCount={extras.phraseBankCount}
        />
      </div>
    </PageBody>
  );
}

export default ContentReviewSectionPage;
