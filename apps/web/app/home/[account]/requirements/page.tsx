import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { RequirementsList } from './_components/requirements-list';
import { createRequirementsService } from './_lib/server/requirements.service';

interface RequirementsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Requirements' });

async function RequirementsPage({ params }: RequirementsPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const requirements = await createRequirementsService(
    getSupabaseServerClient(),
  ).listRequirements(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Requirements"
        description="Applicant briefs and acquisition criteria."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <RequirementsList
          accountId={accountId}
          initialRequirements={requirements}
        />
      </PageBody>
    </>
  );
}

export default withI18n(RequirementsPage);
