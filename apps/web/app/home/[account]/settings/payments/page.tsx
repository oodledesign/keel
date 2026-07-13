import { redirect } from 'next/navigation';

import { createInvoicePaymentSettingsService } from '~/home/[account]/invoices/_lib/server/invoice-payment-settings.service';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
} from '../../_lib/server/workspace-route-guard';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { PaymentSettingsForm } from './_components/payment-settings-form';

export const generateMetadata = async () => ({ title: 'Payment settings' });

interface PaymentSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function PaymentSettingsPage(props: PaymentSettingsPageProps) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, BUSINESS_WORKSPACE_SPACE_TYPES);

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
  const client = getSupabaseServerClient();
  const service = createInvoicePaymentSettingsService(client);
  const [settings, highestInvoiceSequence] = await Promise.all([
    service.getSettings(accountId),
    service.getHighestInvoiceSequence(accountId),
  ]);
  const canEdit = access.isOwner || access.isAdmin;

  return (
    <PaymentSettingsForm
      accountId={accountId}
      accountSlug={account}
      initialSettings={settings}
      canEdit={canEdit}
      highestInvoiceSequence={highestInvoiceSequence}
    />
  );
}
