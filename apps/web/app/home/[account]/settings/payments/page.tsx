import { redirect } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { createInvoicePaymentSettingsService } from '~/home/[account]/invoices/_lib/server/invoice-payment-settings.service';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { PaymentSettingsForm } from './_components/payment-settings-form';

export const generateMetadata = async () => ({ title: 'Payment settings' });

interface PaymentSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function PaymentSettingsPage(props: PaymentSettingsPageProps) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const service = createInvoicePaymentSettingsService(getSupabaseServerClient());
  const settings = await service.getSettings(accountId);
  const canEdit = access.isOwner || access.isAdmin;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Payments"
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <PaymentSettingsForm
          accountId={accountId}
          accountSlug={account}
          initialSettings={settings}
          canEdit={canEdit}
        />
      </PageBody>
    </>
  );
}
