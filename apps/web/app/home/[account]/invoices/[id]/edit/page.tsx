import { notFound } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadInvoicesPageData } from '../../_lib/server/invoices-page.loader';
import { getInvoice } from '../../_lib/server/server-actions';
import { InvoiceEditContent } from '../../_components/invoice-edit-content';

interface InvoiceEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ account: string; id: string }>;
}) => {
  const { id } = await params;
  return { title: `Edit invoice` };
};

async function InvoiceEditPage({ params }: InvoiceEditPageProps) {
  const { account: accountSlug, id } = await params;
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

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={<AppBreadcrumbs values={{ [id]: invoice.invoice_number }} />}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <InvoiceEditContent
          accountSlug={accountSlug}
          accountId={accountId}
          invoice={invoice as Record<string, unknown>}
          canEditInvoices={canEditInvoices}
          canManageInvoiceStatus={canManageInvoiceStatus}
        />
      </PageBody>
    </>
  );
}

export default InvoiceEditPage;
