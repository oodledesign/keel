import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '~/home/(user)/_lib/pipeline-constants';
import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';
import { BUILDING_SURVEYOR_PIPELINE_BOARD_STAGES } from '~/lib/building-surveyor/pipeline-stages';
import {
  loadSurveyorLeadsForAccount,
  loadSurveyorMemberOptions,
} from '~/lib/building-surveyor/surveyor-lead.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { workspaceLinkAccent } from '~/lib/workspace-ui';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../../_lib/role-access';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { SurveyorLeadPageClient } from '../../_components/surveyor/surveyor-lead-page-client';

interface SurveyorLeadPageProps {
  params: Promise<{ account: string; dealId: string }>;
}

export const generateMetadata = async () => ({ title: 'Lead' });

async function SurveyorLeadPage({ params }: SurveyorLeadPageProps) {
  const { account: accountSlug, dealId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'pipeline')) {
    redirect(getDefaultAccountPath(accountSlug));
  }

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [data, leads, members, user] = await Promise.all([
    loadPipelineDataForAccount(accountId),
    loadSurveyorLeadsForAccount(client, accountId),
    loadSurveyorMemberOptions(client, accountId),
    requireUserInServerComponent(),
  ]);

  const deal = data.deals.find((row) => row.id === dealId);
  if (!deal) notFound();

  const businessId = `${PIPELINE_WORKSPACE_BUSINESS_PREFIX}${accountId}`;
  const business = data.businesses.find((row) => row.id === businessId);
  const pipelinePath = pathsConfig.app.accountPipeline.replace(
    '[account]',
    accountSlug,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={deal.contactName || deal.companyName || 'Lead'}
        description={
          <Link
            href={pipelinePath}
            className={`inline-flex items-center gap-1 ${workspaceLinkAccent}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to pipeline
          </Link>
        }
        className="flex px-4 py-3 lg:px-8"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 pb-12 lg:px-8">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 lg:p-6">
          <SurveyorLeadPageClient
            deal={{ ...deal, surveyorLead: leads[deal.id] }}
            context={{
              accountId,
              accountSlug,
              businessId,
              businessName: business?.name ?? '',
              businessColor: business?.color ?? null,
              members,
              stages: BUILDING_SURVEYOR_PIPELINE_BOARD_STAGES.map((stage) => ({
                key: stage.key,
                label: stage.label,
              })),
              currentUserId: user.id,
            }}
          />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(SurveyorLeadPage);
