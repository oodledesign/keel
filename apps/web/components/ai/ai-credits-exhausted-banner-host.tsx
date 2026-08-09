'use client';

import { AiCreditsExhaustedBanner } from './ai-credits-exhausted-banner';
import { useAiCreditsExhausted } from './ai-credits-exhausted-context';

export function AiCreditsExhaustedBannerHost() {
  const { banner, billingHref, dismissBanner } = useAiCreditsExhausted();

  if (!banner.visible || !billingHref) {
    return null;
  }

  return (
    <AiCreditsExhaustedBanner
      billingHref={billingHref}
      creditsRemaining={banner.creditsRemaining}
      creditsRequired={banner.creditsRequired}
      onDismiss={dismissBanner}
    />
  );
}
