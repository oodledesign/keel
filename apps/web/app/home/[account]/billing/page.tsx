import { redirect } from 'next/navigation';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

import { resolveProductPlan } from '@kit/billing-gateway';
import {
  BillingPortalCard,
  CurrentLifetimeOrderCard,
  CurrentSubscriptionCard,
} from '@kit/billing-gateway/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { If } from '@kit/ui/if';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import billingConfig from '~/config/billing.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';

// local imports
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamAccountBillingPage } from '../_lib/server/team-account-billing-page.loader';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { TeamAccountCheckoutForm } from './_components/team-account-checkout-form';
import { createBillingPortalSession } from './_lib/server/server-actions';

interface TeamAccountBillingPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:billing.pageTitle');

  return {
    title,
  };
};

async function TeamAccountBillingPage({ params }: TeamAccountBillingPageProps) {
  const account = (await params).account;
  const workspace = await loadTeamWorkspace(account);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewBilling) {
    redirect(getDefaultAccountPath(account, workspace.account));
  }

  const accountId = workspace.account.id;

  const [subscription, order, customerId] =
    await loadTeamAccountBillingPage(accountId);

  const variantId = subscription?.items[0]?.variant_id;
  const orderVariantId = order?.items[0]?.variant_id;

  const subscriptionProductPlan = variantId
    ? await resolveProductPlan(billingConfig, variantId, subscription.currency)
    : undefined;

  const orderProductPlan = orderVariantId
    ? await resolveProductPlan(billingConfig, orderVariantId, order.currency)
    : undefined;

  const hasBillingData = subscription || order;

  const canManageBilling =
    workspace.account.permissions.includes('billing.manage');

  const shouldShowBillingPortal = canManageBilling && customerId;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={<Trans i18nKey={'common:routes.billing'} />}
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className={cn('flex max-w-2xl flex-col space-y-4')}>
          <If condition={!hasBillingData}>
            <If
              condition={canManageBilling}
              fallback={<CannotManageBillingAlert />}
            >
              <TeamAccountCheckoutForm
                customerId={customerId}
                accountId={accountId}
              />
            </If>
          </If>

          <If condition={subscription}>
            {(subscription) => {
              return (
                <CurrentSubscriptionCard
                  subscription={subscription}
                  product={subscriptionProductPlan!.product}
                  plan={subscriptionProductPlan!.plan}
                />
              );
            }}
          </If>

          <If condition={order}>
            {(order) => {
              return (
                <CurrentLifetimeOrderCard
                  order={order}
                  product={orderProductPlan!.product}
                  plan={orderProductPlan!.plan}
                />
              );
            }}
          </If>

          {shouldShowBillingPortal ? (
            <BillingPortalForm accountId={accountId} account={account} />
          ) : null}
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(TeamAccountBillingPage);

function CannotManageBillingAlert() {
  return (
    <Alert variant={'warning'}>
      <ExclamationTriangleIcon className={'h-4'} />

      <AlertTitle>
        <Trans i18nKey={'billing:cannotManageBillingAlertTitle'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'billing:cannotManageBillingAlertDescription'} />
      </AlertDescription>
    </Alert>
  );
}

function BillingPortalForm({
  accountId,
  account,
}: {
  accountId: string;
  account: string;
}) {
  return (
    <form action={createBillingPortalSession}>
      <input type="hidden" name={'accountId'} value={accountId} />
      <input type="hidden" name={'slug'} value={account} />

      <BillingPortalCard />
    </form>
  );
}
