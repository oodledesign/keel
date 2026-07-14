import { notFound } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { isWorkModuleEnabled } from '../../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { loadInvoicesPageData } from '../../_lib/server/invoices-page.loader';
import { getInvoice } from '../../_lib/server/server-actions';
import { InvoiceEditIndyContent } from '../../_components/invoice-edit-indy-content';

interface InvoiceEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string; id: string }>;
}) => {
  await params;
  return { title: `Edit invoice` };
};

async function InvoiceEditPage({ params }: InvoiceEditPageProps) {
  const { account: accountSlug, id } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);
  if (!isWorkModuleEnabled(workspace.moduleSettings, 'invoices')) {
    notFound();
  }

  const { accountId, canViewInvoices, canEditInvoices, canManageInvoiceStatus } =
    await loadInvoicesPageData(accountSlug);

  if (!id) notFound();
  if (!canViewInvoices) notFound();

  let invoice: Awaited<ReturnType<typeof getInvoice>>;
  try {
    invoice = await getInvoice({ accountId, invoiceId: id });
  } catch {
    notFound();
  }
  if (!invoice) notFound();

  const [brand, accountResult] = await Promise.all([
    loadAccountBrandResolved(accountId).catch(() => null),
    getSupabaseServerClient()
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .maybeSingle(),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={<AppBreadcrumbs values={{ [id]: invoice.invoice_number }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <InvoiceEditIndyContent
          accountSlug={accountSlug}
          accountId={accountId}
          invoice={invoice as Record<string, unknown>}
          canEditInvoices={canEditInvoices}
          canManageInvoiceStatus={canManageInvoiceStatus}
          brandLogoUrl={brand?.logo_url ?? null}
          brandName={
            (accountResult.data?.name as string | null | undefined)?.trim() ||
            null
          }
        />
      </PageBody>
    </>
  );
}

export default InvoiceEditPage;
