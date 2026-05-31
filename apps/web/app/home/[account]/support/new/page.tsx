import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { SupportTicketForm } from '../_components/support-ticket-form';
import { loadSupportPageData } from '../_lib/server/support-page.loader';

interface SupportNewPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'New support ticket' });

async function SupportNewPage({ params }: SupportNewPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const { accountId, canViewSupport } = await loadSupportPageData(accountSlug);

  if (!canViewSupport) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="New ticket"
        description="Create a support ticket for a client"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <SupportTicketForm accountId={accountId} accountSlug={accountSlug} />
      </PageBody>
    </>
  );
}

export default withI18n(SupportNewPage);
