import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { isVoyageConfigured } from '~/lib/brain/voyage';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { BrainChatContent } from './_components/brain-chat-content';

interface BrainPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    jobId?: string;
    clientId?: string;
    jobTitle?: string;
    clientName?: string;
    q?: string;
  }>;
}

export const generateMetadata = async () => ({
  title: 'Second brain',
});

async function BrainPage({ params, searchParams }: BrainPageProps) {
  const { account: accountSlug } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    return null;
  }

  const initialScope =
    query.jobId || query.clientId
      ? {
          jobId: query.jobId,
          clientId: query.clientId,
          jobTitle: query.jobTitle,
          clientName: query.clientName,
        }
      : undefined;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Second brain"
        description="Chat with your indexed notes, docs, jobs, transcripts, and proposals."
      />
      <PageBody>
        <BrainChatContent
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          voyageConfigured={isVoyageConfigured()}
          initialScope={initialScope}
          starterQuestion={query.q}
        />
      </PageBody>
    </>
  );
}

export default withI18n(BrainPage);
