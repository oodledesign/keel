import Link from 'next/link';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

import { resolveProductPlan } from '@kit/billing-gateway';
import {
  BillingPortalCard,
  CurrentLifetimeOrderCard,
  CurrentSubscriptionCard,
} from '@kit/billing-gateway/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';

import billingConfig from '~/config/billing.config';
import pathsConfig from '~/config/paths.config';
import { loadTeamAccountBillingPage } from '~/home/[account]/_lib/server/team-account-billing-page.loader';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { CommercialSeatQuantityCard } from '~/home/[account]/billing/_components/commercial-seat-quantity-card';
import { BusinessSeatQuantityCard } from '~/home/[account]/billing/_components/business-seat-quantity-card';
import { OzerWorkspaceCheckoutForm } from '~/home/[account]/billing/_components/ozer-workspace-checkout-form';
import { createBillingPortalSession } from '~/home/[account]/billing/_lib/server/server-actions';
import { isBillingRecoveryStatus } from '~/lib/billing/billing-recovery';
import { hasBusinessLiteEntitlement } from '~/lib/billing/business-lite';
import { checkAccountAccess } from '~/lib/billing/check-account-access';
import { loadAccountPlanLimits } from '~/lib/billing/entitlements';
import { loadWorkspaceAddonState } from '~/lib/billing/workspace-addon-state.loader';
import { getCommercialSeatBreakdown } from '~/lib/commercial/commercial-seat-access';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PaymentRecoveryCard } from '../../_components/payment-recovery-card';
import { getTeamAccountAccess } from '../../_lib/role-access';
import { ActiveAddonsBillingCard } from './active-addons-billing-card';
import { MediaGenerateAppToggle } from './media-generate-app-toggle';
import { WorkspaceAiCreditsBillingCard } from './workspace-ai-credits-billing-card';
import { WorkspaceMediaUnitsBillingCard } from './workspace-media-units-billing-card';
import { WorkspacePlanStatusCard } from './workspace-plan-status-card';

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
  const isCommercial = workspace.workspaceProfile === 'commercial_property';
  const isBusinessWorkspace = workspace.workspaceProfile === 'work_design';

  const [subscription, order, customerId] =
    await loadTeamAccountBillingPage(accountId);

  const variantId = subscription?.items?.[0]?.variant_id;
  const orderVariantId = order?.items?.[0]?.variant_id;

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
  const recovered = paymentUpdated && accessState.status === 'active';
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

  const hasAnyActiveAddon = Object.values(addonState.addons).some(Boolean);
  const showMediaGenerate =
    canManageBilling && Boolean(addonState.addons.addon_media_generate);

  const commercialBreakdown = isCommercial
    ? await getCommercialSeatBreakdown(billingClient, accountId)
    : null;
  const planLimits =
    isCommercial || isBusinessWorkspace
      ? await loadAccountPlanLimits(billingClient, accountId)
      : null;
  const pendingBillableSeats = planLimits?.pending_billable_seats ?? null;
  const pendingSeatsEffectiveAt =
    planLimits?.pending_seats_effective_at ?? null;

  let businessSubscribedSeats = 1;
  let businessMemberCount = 0;
  if (isBusinessWorkspace && subscriptionIsWorkspacePlan) {
    const quantity =
      subscription?.items?.find((item) => item.type === 'per_seat')?.quantity ??
      planLimits?.max_members ??
      1;
    businessSubscribedSeats = Math.max(1, quantity);
    const { count } = await billingClient
      .from('accounts_memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('account_id', accountId);
    businessMemberCount = count ?? 0;
  }

  const billingDescription = isCommercial
    ? 'Workspace plan, seats, AI credits, and Stripe billing portal.'
    : isBusinessWorkspace
      ? 'Workspace plan, seats, AI credits, and Stripe billing portal.'
      : hasAnyActiveAddon
        ? 'Workspace plan, your apps, AI credits, and Stripe billing portal.'
        : 'Workspace plan, AI credits, and Stripe billing portal.';

  const addonsCatalogPath = pathsConfig.app.accountAddonsSettings.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Billing</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {billingDescription}
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
          billingExempt={
            accessState.exempt && accessState.reason === 'billing_exempt'
          }
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

        <If
          condition={!showPlanCheckout && !canManageBilling && !hasBillingData}
        >
          <CannotManageBillingAlert />
        </If>

        {isCommercial && commercialBreakdown && subscriptionIsWorkspacePlan ? (
          <CommercialSeatQuantityCard
            accountId={accountId}
            accountSlug={accountSlug}
            canManageBilling={canManageBilling}
            subscribedBillable={commercialBreakdown.subscribedBillable}
            billableAssigned={commercialBreakdown.billableCount}
            supportAssigned={commercialBreakdown.supportCount}
            pendingBillableSeats={pendingBillableSeats}
            pendingEffectiveAt={pendingSeatsEffectiveAt}
          />
        ) : null}

        {isBusinessWorkspace &&
        !isBusinessLite &&
        subscriptionIsWorkspacePlan ? (
          <BusinessSeatQuantityCard
            accountId={accountId}
            accountSlug={accountSlug}
            canManageBilling={canManageBilling}
            subscribedBillable={businessSubscribedSeats}
            membersAssigned={businessMemberCount}
            pendingBillableSeats={pendingBillableSeats}
            pendingEffectiveAt={pendingSeatsEffectiveAt}
          />
        ) : null}

        <ActiveAddonsBillingCard
          accountSlug={accountSlug}
          activeAddons={addonState.addons}
        />

        {!hasAnyActiveAddon && canManageBilling ? (
          <p className="text-muted-foreground text-sm">
            Need an app?{' '}
            <Link
              href={addonsCatalogPath}
              className="text-[var(--workspace-shell-text)] underline underline-offset-2"
            >
              Browse available add-ons
            </Link>
          </p>
        ) : null}

        <WorkspaceAiCreditsBillingCard
          accountId={accountId}
          accountSlug={accountSlug}
          canManageBilling={canManageBilling}
        />

        {showMediaGenerate ? (
          <>
            <MediaGenerateAppToggle
              accountId={accountId}
              accountSlug={accountSlug}
              billingHref={`/home/${accountSlug}/settings/billing`}
            />
            <WorkspaceMediaUnitsBillingCard
              accountId={accountId}
              accountSlug={accountSlug}
              canManageBilling={canManageBilling}
            />
          </>
        ) : null}

        {subscription &&
        subscriptionIsWorkspacePlan &&
        subscriptionProductPlan ? (
          <CurrentSubscriptionCard
            subscription={{
              ...subscription,
              items: subscription.items ?? [],
            }}
            product={subscriptionProductPlan.product}
            plan={subscriptionProductPlan.plan}
          />
        ) : null}

        {order && orderProductPlan ? (
          <CurrentLifetimeOrderCard
            order={{
              ...order,
              items: order.items ?? [],
            }}
            product={orderProductPlan.product}
            plan={orderProductPlan.plan}
          />
        ) : null}

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
