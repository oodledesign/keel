import { cache } from 'react';

import { AdminAccountPage } from '@kit/admin/components/admin-account-page';
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { AdminBillingGrantsPanel } from './_components/admin-billing-grants-panel';
import { AdminPersonalAddonsPanel } from './_components/admin-personal-addons-panel';
import { loadAdminAccountBillingState } from './_lib/load-admin-account-billing';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export const generateMetadata = async (props: Params) => {
  const params = await props.params;
  const account = await loadAccount(params.id);

  return {
    title: `Admin | ${account.name}`,
  };
};

async function AccountPage(props: Params) {
  const params = await props.params;
  const account = await loadAccount(params.id);
  const billing = await loadAdminAccountBillingState(params.id);
  const isPersonal = account.is_personal_account;

  return (
    <>
      <AdminAccountPage account={account} />
      {isPersonal ? (
        <PageBody className="border-t py-4">
          <div className="mx-auto max-w-3xl px-4">
            <AdminPersonalAddonsPanel
              accountId={params.id}
              entitlements={billing.entitlements}
              billingExempt={billing.billingExempt}
            />
          </div>
        </PageBody>
      ) : (
        <PageBody className="border-t py-4">
          <div className="mx-auto max-w-3xl px-4">
            <AdminBillingGrantsPanel
              accountId={params.id}
              entitlements={billing.entitlements}
              billingExempt={billing.billingExempt}
            />
          </div>
        </PageBody>
      )}
    </>
  );
}

export default AdminGuard(AccountPage);

const loadAccount = cache(accountLoader);

async function accountLoader(id: string) {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('accounts')
    .select('*, memberships: accounts_memberships (*)')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
