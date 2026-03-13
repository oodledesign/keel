import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadInvoicesPageData } from './_lib/server/invoices-page.loader';
import { InvoicesPageContent } from './_components/invoices-page-content';

interface InvoicesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = () => {
  return { title: 'Invoices' };
};

async function InvoicesPage({ params }: InvoicesPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewInvoices) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const { accountId, canViewInvoices, canEditInvoices, canManageInvoiceStatus } =
    await loadInvoicesPageData(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Invoices"
        description="Create and manage invoices"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <InvoicesPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canViewInvoices={canViewInvoices}
          canEditInvoices={canEditInvoices}
          canManageInvoiceStatus={canManageInvoiceStatus}
        />
      </PageBody>
    </>
  );
}

export default InvoicesPage;
