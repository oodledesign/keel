import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import featureFlagsConfig from '~/config/feature-flags.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { UserSubscriptionsHub } from './_components/user-subscriptions-hub';
import { loadUserSubscriptionsHub } from './_lib/server/user-subscriptions-hub.loader';
import { PersonalAccountCheckoutForm } from './_components/personal-account-checkout-form';
import { loadPersonalAccountBillingPageData } from './_lib/server/personal-account-billing-page.loader';
import { createPersonalAccountBillingPortalSession } from './_lib/server/server-actions';
import { BillingPortalCard } from '@kit/billing-gateway/components';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return { title: i18n.t('account:billingTab') };
};

async function PersonalAccountBillingPage() {
  const user = await requireUserInServerComponent();
  const hubRows = await loadUserSubscriptionsHub(user.id);

  const showLegacyPersonalCheckout =
    featureFlagsConfig.enablePersonalAccountBilling;

  let personalCheckout: React.ReactNode = null;
  if (showLegacyPersonalCheckout) {
    const [subscription, order, customerId] =
      await loadPersonalAccountBillingPageData(user.id);
    const hasBillingData = subscription || order;
    if (!hasBillingData) {
      personalCheckout = (
        <PersonalAccountCheckoutForm customerId={customerId} />
      );
    }
  }

  return (
    <>
      <HomeLayoutPageHeader
        title="Billing & subscriptions"
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-auto flex max-w-2xl flex-col space-y-6">
          <UserSubscriptionsHub
            rows={hubRows}
            stripePortalAction={
              <form action={createPersonalAccountBillingPortalSession}>
                <BillingPortalCard />
              </form>
            }
          />
          {personalCheckout}
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(PersonalAccountBillingPage);
