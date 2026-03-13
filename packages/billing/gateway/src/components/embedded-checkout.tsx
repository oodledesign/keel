import { Suspense, lazy } from 'react';

import { Enums } from '@kit/supabase/database';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

type BillingProvider = Enums<'billing_provider'>;

// Create lazy components at module level (not during render)
const StripeCheckoutLazy = lazy(async () => {
  const { StripeCheckout } = await import('@kit/stripe/components');
  return { default: StripeCheckout };
});

const LemonSqueezyCheckoutLazy = lazy(async () => {
  const { LemonSqueezyEmbeddedCheckout } =
    await import('@kit/lemon-squeezy/components');
  return { default: LemonSqueezyEmbeddedCheckout };
});

type CheckoutProps = {
  onClose: (() => unknown) | undefined;
  checkoutToken: string;
};

export function EmbeddedCheckout(
  props: React.PropsWithChildren<{
    checkoutToken: string;
    provider: BillingProvider;
    onClose?: () => void;
  }>,
) {
  return (
    <>
      <Suspense fallback={<LoadingOverlay fullPage={false} />}>
        <CheckoutSelector
          provider={props.provider}
          onClose={props.onClose}
          checkoutToken={props.checkoutToken}
        />
      </Suspense>

      <BlurryBackdrop />
    </>
  );
}

function CheckoutSelector(
  props: CheckoutProps & { provider: BillingProvider },
) {
  switch (props.provider) {
    case 'stripe':
      return (
        <StripeCheckoutLazy
          onClose={props.onClose}
          checkoutToken={props.checkoutToken}
        />
      );

    case 'lemon-squeezy':
      return (
        <LemonSqueezyCheckoutLazy
          onClose={props.onClose}
          checkoutToken={props.checkoutToken}
        />
      );

    case 'paddle':
      throw new Error('Paddle is not yet supported');

    default:
      throw new Error(`Unsupported provider: ${props.provider as string}`);
  }
}

function BlurryBackdrop() {
  return (
    <div
      className={
        'bg-background/30 fixed top-0 left-0 w-full backdrop-blur-sm' +
        ' !m-0 h-full'
      }
    />
  );
}
