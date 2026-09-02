import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

import { workspacePageBodyClassName } from '~/components/workspace-shell/workspace-shell-styles';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { InvoicesPageContent } from './_components/invoices-page-content';
import { loadInvoicesPageInitialData } from './_lib/server/invoices-page-initial.loader';
import { loadInvoicesPageData } from './_lib/server/invoices-page.loader';

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

  if (
    !access.canViewInvoices ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'invoices')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const {
    accountId,
    canViewInvoices,
    canEditInvoices,
    canManageInvoiceStatus,
  } = await loadInvoicesPageData(accountSlug);

  const initialData = await loadInvoicesPageInitialData(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Invoices"
        description="Create and manage invoices"
        account={accountSlug}
      />

      <PageBody className={cn(workspacePageBodyClassName, 'py-4 md:py-6')}>
        <InvoicesPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canViewInvoices={canViewInvoices}
          canEditInvoices={canEditInvoices}
          canManageInvoiceStatus={canManageInvoiceStatus}
          initialInvoices={initialData.invoices as never}
          initialTotal={initialData.total}
          initialCounts={initialData.counts}
          initialSummary={initialData.summary}
          initialClients={initialData.clients}
        />
      </PageBody>
    </>
  );
}

export default InvoicesPage;
