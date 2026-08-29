import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { CirculationWorkspaceClient } from './_components/circulation-workspace-client';
import { loadCirculationWorkspaceData } from './_lib/server/circulation-workspace.loader';

interface CirculationPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Circulation' });

async function CirculationPage({ params }: CirculationPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const data = await loadCirculationWorkspaceData(
    getSupabaseServerClient(),
    accountId,
  );

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Circulation" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <CirculationWorkspaceClient
          accountId={accountId}
          agencyName={data.agencyName}
          fromEmail={data.fromEmail}
          fromName={data.fromName}
          initialAutoSendEnabled={data.autoSendEnabled}
          initialContacts={data.contacts}
          initialSends={data.sends}
        />
      </PageBody>
    </>
  );
}

export default withI18n(CirculationPage);
