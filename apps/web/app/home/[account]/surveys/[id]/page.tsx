import { notFound } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { loadProposalsPageData } from '../../proposals/_lib/server/proposals-page.loader';
import { getProposal } from '../../proposals/_lib/server/server-actions';
import { SurveyHubContent } from '../_components/survey-hub-content';
import { loadSurveyHubExtras } from '../_lib/server/survey-hub.loader';

interface SurveyHubPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Survey' };
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

  const extras = await loadSurveyHubExtras({
    accountId,
    proposalId: id,
    clientId: (proposal as { client_id?: string | null }).client_id,
    dealId: (proposal as { deal_id?: string | null }).deal_id,
  });

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
        <SurveyHubContent
          accountSlug={accountSlug}
          accountId={accountId}
          accountName={accountName}
          senderName={senderName}
          canEdit={canEditProposals}
          proposal={
            proposal as {
              id: string;
              title?: string | null;
              status: string;
              content_html?: string | null;
              recipient_name?: string | null;
              client_id?: string | null;
              deal_id?: string | null;
              survey_type?: string | null;
              client?: {
                id: string;
                display_name?: string | null;
                first_name?: string | null;
                last_name?: string | null;
                company_name?: string | null;
                email?: string | null;
                address_line_1?: string | null;
                address_line_2?: string | null;
                city?: string | null;
                postcode?: string | null;
              } | null;
              deal?: {
                id: string;
                name?: string | null;
                contact_name?: string | null;
                company_name?: string | null;
                stage?: string | null;
              } | null;
              updated_at?: string | null;
            }
          }
          observations={extras.observations}
          transcripts={extras.transcripts}
          photoShare={extras.photoShare}
          styleExampleCount={extras.styleExampleCount}
        />
      </PageBody>
    </>
  );
}

export default SurveyHubPage;
