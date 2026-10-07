'use client';

import { usePathname } from 'next/navigation';

import { CookieBanner } from '@kit/ui/cookie-banner';

import { GoogleAnalytics } from '~/components/google-analytics';

/**
 * Public form pages are embedded in customers' own sites. They set no
 * cookies and must not show Ozer's consent banner or load Ozer analytics
 * inside someone else's page.
 */
const NO_CONSENT_CHROME_PREFIXES = ['/share/form'] as const;

export function ConsentChrome() {
  const pathname = usePathname() ?? '';

  if (
    NO_CONSENT_CHROME_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  return (
    <>
      <CookieBanner />
      <GoogleAnalytics />
    </>
  );
}
