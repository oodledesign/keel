'use client';

import { useEffect } from 'react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { useCookieConsent } from '@kit/ui/cookie-banner';

import {
  disablePostHogBrowser,
  getPostHogBrowserToken,
  identifyPostHogUser,
  initPostHogBrowser,
} from '~/lib/analytics/posthog-browser';

/**
 * Loads PostHog (EU) only after the user accepts analytics cookies.
 * Mirrors Google Analytics consent gating.
 */
export function PostHogProvider(props: React.PropsWithChildren) {
  const { status } = useCookieConsent();
  const hasToken = Boolean(getPostHogBrowserToken());

  useEffect(() => {
    if (!hasToken) {
      return;
    }

    if (status === 'accepted') {
      const ready = initPostHogBrowser();

      if (ready) {
        void identifySignedInUser();
      }

      return;
    }

    if (status === 'rejected') {
      disablePostHogBrowser();
    }
  }, [hasToken, status]);

  return props.children;
}

async function identifySignedInUser() {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      return;
    }

    identifyPostHogUser(user.id, {
      email: user.email ?? '',
    });
  } catch {
    // Identification is best-effort after consent.
  }
}
