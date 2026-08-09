'use client';

import { AiCreditsExhaustedBannerHost } from '~/components/ai/ai-credits-exhausted-banner-host';
import { AiCreditsExhaustedProvider } from '~/components/ai/ai-credits-exhausted-context';

/**
 * Provides AI-credits-exhausted toast/banner context and mounts the dismissible banner.
 * Place workspace billing banners as siblings alongside `{children}` under this wrapper.
 */
export function AiCreditsExhaustedShell({
  accountId,
  billingHref,
  children,
}: {
  accountId: string;
  billingHref: string;
  children: React.ReactNode;
}) {
  return (
    <AiCreditsExhaustedProvider accountId={accountId} billingHref={billingHref}>
      <AiCreditsExhaustedBannerHost />
      {children}
    </AiCreditsExhaustedProvider>
  );
}
