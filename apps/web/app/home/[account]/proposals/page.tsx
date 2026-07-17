import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { loadPipelineDataForAccount } from '~/home/(user)/_lib/server/pipeline.loader';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { ProposalsPageContent } from './_components/proposals-page-content';
import { loadProposalsPageData } from './_lib/server/proposals-page.loader';

interface ProposalsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = () => {
  return { title: 'Proposals' };
};

async function ProposalsPage({ params }: ProposalsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewInvoices ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'invoices')
  ) {
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

  const {
    accountId,
    canViewProposals,
    canEditProposals,
    canManageProposalStatus,
    user,
  } = await loadProposalsPageData(accountSlug);

  const pipeline = await loadPipelineDataForAccount(accountId);
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
        title="Proposals"
        description="Create and send proposals for client approval"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <ProposalsPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          accountName={accountName}
          senderName={senderName}
          canViewProposals={canViewProposals}
          canEditProposals={canEditProposals}
          canManageProposalStatus={canManageProposalStatus}
          deals={pipeline.deals.map((d) => ({
            id: d.id,
            contactName: d.contactName,
            companyName: d.companyName,
            value: d.value,
          }))}
        />
      </PageBody>
    </>
  );
}

export default ProposalsPage;
