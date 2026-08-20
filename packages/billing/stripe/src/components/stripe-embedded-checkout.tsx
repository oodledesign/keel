'use client';

import { useState } from 'react';

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

import { Dialog, DialogContent, DialogTitle } from '@kit/ui/dialog';

import { StripeClientEnvSchema } from '../schema/stripe-client-env.schema';

const { publishableKey } = StripeClientEnvSchema.parse({
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

const stripePromise = loadStripe(publishableKey);

/**
 * Served from apps/web/public. Stripe Embedded Checkout does not render
 * Dashboard logo/icon assets inside the iframe, so we brand the dialog chrome.
 */
const OZER_ICON_SRC = '/brand/ozer-icon.svg';
const OZER_WORDMARK_SRC = '/brand/ozer-wordmark-on-light.svg';

export function StripeCheckout({
  checkoutToken,
  onClose,
}: React.PropsWithChildren<{
  checkoutToken: string;
  onClose?: () => void;
}>) {
  return (
    <EmbeddedCheckoutPopup key={checkoutToken} onClose={onClose}>
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret: checkoutToken }}
      >
        <EmbeddedCheckout className={'EmbeddedCheckoutClassName'} />
      </EmbeddedCheckoutProvider>
    </EmbeddedCheckoutPopup>
  );
}

function EmbeddedCheckoutPopup({
  onClose,
  children,
}: React.PropsWithChildren<{
  onClose?: () => void;
}>) {
  const [open, setOpen] = useState(true);
  const className = `bg-[#FBF6EC] p-4 overflow-y-auto shadow-transparent border`;

  return (
    <Dialog
      defaultOpen
      open={open}
      onOpenChange={(open) => {
        if (!open && onClose) {
          onClose();
        }

        setOpen(open);
      }}
    >
      <DialogContent
        style={{
          maxHeight: '98vh',
        }}
        className={className}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className={'sr-only'}>Ozer checkout</DialogTitle>
        <div className="mb-3 flex items-center gap-2.5">
          <img
            src={OZER_ICON_SRC}
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0"
          />
          <img
            src={OZER_WORDMARK_SRC}
            alt="Ozer"
            width={92}
            height={22}
            className="h-[22px] w-auto"
          />
        </div>
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
