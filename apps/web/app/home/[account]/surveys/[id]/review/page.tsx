import { notFound, redirect } from 'next/navigation';

import {
  deskReviewSections,
  firstDeskReviewSectionKey,
} from '~/lib/building-surveyor/survey-desk-review';

import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { loadProposalsPageData } from '../../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../../proposals/_lib/server/server-actions';
import { loadSurveyHubExtras } from '../../_lib/server/survey-hub.loader';

interface DeskReviewIndexProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Desk review' };
};

async function DeskReviewIndexPage({ params }: DeskReviewIndexProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'proposals')) {
    notFound();
  }

  const { accountId, canViewProposals } =
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
  const sectionKey = firstDeskReviewSectionKey(sections);

  redirect(`/home/${accountSlug}/surveys/${id}/review/${sectionKey}`);
}

export default DeskReviewIndexPage;
