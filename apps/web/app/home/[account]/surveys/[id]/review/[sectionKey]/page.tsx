import { notFound, redirect } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import {
  deskReviewSectionByKey,
  deskReviewSections,
} from '~/lib/building-surveyor/survey-desk-review';

import { TeamAccountLayoutPageHeader } from '../../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../_lib/server/workspace-route-guard';
import { loadProposalsPageData } from '../../../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../../../proposals/_lib/server/server-actions';
import { SurveyDeskReviewClient } from '../../../_components/survey-desk-review-client';
import { loadSurveyHubExtras } from '../../../_lib/server/survey-hub.loader';

interface DeskReviewSectionPageProps {
  params: Promise<{ account: string; id: string; sectionKey: string }>;
}

export const generateMetadata = async ({
  params,
}: DeskReviewSectionPageProps) => {
  const { sectionKey } = await params;
  const section = deskReviewSectionByKey(sectionKey);
  return { title: section ? `${section.ricsCode} desk review` : 'Desk review' };
};

async function DeskReviewSectionPage({ params }: DeskReviewSectionPageProps) {
  const { account: accountSlug, id, sectionKey } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'proposals')) {
    notFound();
  }

  const { accountId, canViewProposals, canEditProposals } =
    await loadProposalsPageData(accountSlug);
  if (!id || !canViewProposals) notFound();

  let proposal: Awaited<ReturnType<typeof getProposal>>;
  try {
    proposal = await getProposal({ accountId, proposalId: id });
  } catch {
    notFound();
  }
  if (!proposal) notFound();
  const kind = (proposal as { kind?: string }).kind;
  if (kind && kind !== 'survey_report') notFound();

  const extras = await loadSurveyHubExtras({
    accountId,
    proposalId: id,
    clientId: (proposal as { client_id?: string | null }).client_id,
    dealId: (proposal as { deal_id?: string | null }).deal_id,
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
      redirect(`/home/${accountSlug}/surveys/${id}/review/${fallback}`);
    }
    notFound();
  }

  const title =
    (proposal as { title?: string | null }).title?.trim() || 'Building survey';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={`${title} · desk review`}
        description={<AppBreadcrumbs values={{ [id]: title }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-4 pb-[calc(5.5rem+max(1.5rem,env(safe-area-inset-bottom)))] md:px-6 md:py-6 md:pb-6">
        <SurveyDeskReviewClient
          accountSlug={accountSlug}
          accountId={accountId}
          proposalId={id}
          proposalTitle={title}
          canEdit={canEditProposals}
          clientId={(proposal as { client_id?: string | null }).client_id}
          sections={sections}
          currentKey={sectionKey}
          observations={extras.observations}
        />
      </PageBody>
    </>
  );
}

export default DeskReviewSectionPage;
