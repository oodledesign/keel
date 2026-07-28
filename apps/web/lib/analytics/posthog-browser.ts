'use client';

import posthog from 'posthog-js';

const DEFAULT_EU_HOST = 'https://eu.i.posthog.com';
const DEFAULT_EU_UI_HOST = 'https://eu.posthog.com';

let initAttempted = false;

export function getPostHogBrowserToken(): string | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  return token || null;
}

export function getPostHogBrowserHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_EU_HOST;
}

export function isPostHogBrowserReady(): boolean {
  return Boolean(posthog.__loaded);
}

/**
 * Initialise PostHog only after analytics cookie consent.
 * Session replay uses project settings (30-day retention) plus SDK input masking.
 */
export function initPostHogBrowser(): boolean {
  const token = getPostHogBrowserToken();

  if (!token || typeof window === 'undefined') {
    return false;
  }

  if (posthog.__loaded) {
    posthog.opt_in_capturing();
    posthog.set_config({ disable_session_recording: false });
    return true;
  }

  if (initAttempted) {
    return Boolean(posthog.__loaded);
  }

  initAttempted = true;

  posthog.init(token, {
    api_host: getPostHogBrowserHost(),
    ui_host:
      process.env.NEXT_PUBLIC_POSTHOG_UI_HOST?.trim() || DEFAULT_EU_UI_HOST,
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: 'input, textarea, [contenteditable]',
    },
  });

  return true;
}

export function disablePostHogBrowser(): void {
  if (!posthog.__loaded) {
    return;
  }

  posthog.set_config({ disable_session_recording: true });
  posthog.opt_out_capturing();
}

export function identifyPostHogUser(
  userId: string,
  traits?: Record<string, string>,
): void {
  if (!posthog.__loaded) {
    return;
  }

  posthog.identify(userId, traits);
}

export function resetPostHogUser(): void {
  if (!posthog.__loaded) {
    return;
  }

  posthog.reset();
}

export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthog.__loaded) {
    return;
  }

  posthog.capture(eventName, properties);
}

export { posthog };
