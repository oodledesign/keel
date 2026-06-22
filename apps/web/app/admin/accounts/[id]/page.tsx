import { AdminAccountPage } from '@kit/admin/components/admin-account-page';
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody } from '@kit/ui/page';

import { AdminBillingGrantsPanel } from './_components/admin-billing-grants-panel';
import { AdminPersonalAddonsPanel } from './_components/admin-personal-addons-panel';
import { loadAdminAccountBillingState } from './_lib/load-admin-account-billing';
import { loadAdminAccount } from './_lib/load-admin-account';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export const generateMetadata = async (props: Params) => {
  const params = await props.params;
  const account = await loadAdminAccount(params.id);

  return {
    title: `Admin | ${account.name}`,
  };
};

async function AccountPage(props: Params) {
  const params = await props.params;
  const account = await loadAdminAccount(params.id);
  const billing = await loadAdminAccountBillingState(account.id);
  const isPersonal = account.is_personal_account;

  return (
    <>
      <AdminAccountPage account={account} />
      {isPersonal ? (
        <PageBody className="border-t py-4">
          <div className="mx-auto max-w-3xl px-4">
            <AdminPersonalAddonsPanel
              accountId={account.id}
              entitlements={billing.entitlements}
              billingExempt={billing.billingExempt}
            />
          </div>
        </PageBody>
      ) : (
        <PageBody className="border-t py-4">
          <div className="mx-auto max-w-3xl px-4">
            <AdminBillingGrantsPanel
              accountId={account.id}
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
