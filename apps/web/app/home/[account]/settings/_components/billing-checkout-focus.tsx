'use client';

import { useEffect } from 'react';

import { useSearchParams } from 'next/navigation';

/**
 * Scrolls to the workspace plan checkout when opened via ?billing=1 or ?upgrade=1.
 */
export function BillingCheckoutFocus() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const shouldFocus =
      searchParams.get('billing') === '1' ||
      searchParams.get('upgrade') === '1';

    if (!shouldFocus) {
      return;
    }

    const node = document.getElementById('workspace-plan-checkout');
    if (!node) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchParams]);

  return null;
}
