'use client';

import { useEffect, useMemo, useState } from 'react';

import { usePathname } from 'next/navigation';
import Script from 'next/script';

import { useCookieConsent } from '@kit/ui/cookie-banner';

import { resolveGoogleAnalyticsMeasurementId } from '~/config/analytics.config';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function trackPageView(measurementId: string, path: string) {
  if (typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('config', measurementId, {
    page_path: path,
  });
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const { status } = useCookieConsent();
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  const measurementId = useMemo(() => {
    if (!hostname) {
      return null;
    }

    return resolveGoogleAnalyticsMeasurementId(pathname, hostname);
  }, [hostname, pathname]);

  const hasConsent = status === 'accepted';

  useEffect(() => {
    if (!hasConsent || !measurementId) {
      return;
    }

    trackPageView(measurementId, pathname);
  }, [hasConsent, measurementId, pathname]);

  if (!hasConsent || !measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="keel-google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
