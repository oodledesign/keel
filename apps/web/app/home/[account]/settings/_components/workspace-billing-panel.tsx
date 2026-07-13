import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

import { resolveProductPlan } from '@kit/billing-gateway';
import {
  BillingPortalCard,
  CurrentLifetimeOrderCard,
  CurrentSubscriptionCard,
} from '@kit/billing-gateway/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';

import billingConfig from '~/config/billing.config';
import { OzerAddonCheckoutSection } from '~/home/[account]/billing/_components/ozer-addon-checkout-section';
import { OzerWorkspaceCheckoutForm } from '~/home/[account]/billing/_components/ozer-workspace-checkout-form';
import { createBillingPortalSession } from '~/home/[account]/billing/_lib/server/server-actions';
import { loadTeamAccountBillingPage } from '~/home/[account]/_lib/server/team-account-billing-page.loader';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { hasBusinessLiteEntitlement } from '~/lib/billing/business-lite';
import { loadWorkspaceAddonState } from '~/lib/billing/workspace-addon-state.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { WorkspaceAiCreditsBillingCard } from './workspace-ai-credits-billing-card';
import { WorkspacePlanStatusCard } from './workspace-plan-status-card';
import { PaymentRecoveryCard } from '../../_components/payment-recovery-card';
import { getTeamAccountAccess } from '../../_lib/role-access';
import { checkAccountAccess } from '~/lib/billing/check-account-access';
import { isBillingRecoveryStatus } from '~/lib/billing/billing-recovery';

type WorkspaceBillingPanelProps = {
  accountSlug: string;
  searchParams: {
    addon?: string;
    setup?: string;
    upgrade?: string;
    billing?: string;
    payment_updated?: string;
  };
};

export async function WorkspaceBillingPanel({
  accountSlug,
  searchParams,
}: WorkspaceBillingPanelProps) {
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewBilling) {
    return <CannotManageBillingAlert />;
  }

  const accountId = workspace.account.id as string;
  const canManageBilling = access.canManageBilling;

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

  const hasBillingData = Boolean(subscription || order);
  const shouldShowBillingPortal = canManageBilling && Boolean(customerId);

  const user = await requireUserInServerComponent();
  const billingClient = getSupabaseServerClient();
  const addonState = await loadWorkspaceAddonState(
    billingClient,
    user.id,
    accountId,
    workspace.workspaceProfile,
  );

  const isBusinessLite = await hasBusinessLiteEntitlement(
    billingClient,
    accountId,
  );
  const showPlanCheckout =
    !hasBillingData && !isBusinessLite && canManageBilling;
  const isUpgradeIntent = searchParams.upgrade === '1';
  const showLiteUpgrade =
    isBusinessLite && canManageBilling && isUpgradeIntent && !hasBillingData;

  const accessState = await checkAccountAccess(billingClient, accountId);
  const paymentUpdated = searchParams.payment_updated === '1';
  const recovered =
    paymentUpdated && accessState.status === 'active';
  const showPaymentRecovery =
    canManageBilling &&
    (recovered ||
      paymentUpdated ||
      isBillingRecoveryStatus(accessState.status));

  const subscriptionIsWorkspacePlan = Boolean(
    subscriptionProductPlan &&
      !subscriptionProductPlan.product.id.startsWith('ozer-addon-') &&
      !subscriptionProductPlan.product.id.startsWith('ozer-ai-credits-'),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace plan, Signatures, AI credits, and Stripe billing portal.
        </p>
      </div>

      <div className="flex max-w-2xl flex-col gap-4">
        {showPaymentRecovery ? (
          <PaymentRecoveryCard
            accountId={accountId}
            accountSlug={accountSlug}
            status={accessState.status}
            hasStripeCustomer={Boolean(customerId)}
            paymentUpdated={paymentUpdated}
            recovered={recovered}
          />
        ) : null}

        <WorkspacePlanStatusCard
          isBusinessLite={isBusinessLite}
          hasPaidSubscription={subscriptionIsWorkspacePlan}
          subscriptionProductPlan={
            subscriptionIsWorkspacePlan ? subscriptionProductPlan : undefined
          }
          canManageBilling={canManageBilling}
          accountSlug={accountSlug}
          billingStatus={accessState.status}
        />

        <If condition={showPlanCheckout}>
          <OzerWorkspaceCheckoutForm
            customerId={customerId}
            accountId={accountId}
            workspaceProfile={workspace.workspaceProfile}
            upgradeFromLite={isUpgradeIntent && isBusinessLite}
          />
        </If>

        <If condition={showLiteUpgrade && !showPlanCheckout}>
          <OzerWorkspaceCheckoutForm
            customerId={customerId}
            accountId={accountId}
            workspaceProfile={workspace.workspaceProfile}
            upgradeFromLite
          />
        </If>

        <If condition={!showPlanCheckout && !canManageBilling && !hasBillingData}>
          <CannotManageBillingAlert />
        </If>

        <If condition={canManageBilling}>
          <OzerAddonCheckoutSection
            accountId={accountId}
            workspacePaid={addonState.workspacePaid}
            activeAddons={addonState.addons}
            highlightAddon={searchParams.addon ?? null}
          />
        </If>

        <WorkspaceAiCreditsBillingCard
          accountId={accountId}
          accountSlug={accountSlug}
          canManageBilling={canManageBilling}
        />

        <If condition={subscription && subscriptionIsWorkspacePlan}>
          {(activeSubscription) => (
            <CurrentSubscriptionCard
              subscription={activeSubscription}
              product={subscriptionProductPlan!.product}
              plan={subscriptionProductPlan!.plan}
            />
          )}
        </If>

        <If condition={order}>
          {(activeOrder) => (
            <CurrentLifetimeOrderCard
              order={activeOrder}
              product={orderProductPlan!.product}
              plan={orderProductPlan!.plan}
            />
          )}
        </If>

        {shouldShowBillingPortal ? (
          <BillingPortalForm accountId={accountId} account={accountSlug} />
        ) : null}
      </div>
    </div>
  );
}

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
      <input type="hidden" name={'intent'} value="manage" />

      <BillingPortalCard />
    </form>
  );
}
