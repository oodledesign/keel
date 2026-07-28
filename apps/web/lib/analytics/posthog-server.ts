import 'server-only';

import { PostHog } from 'posthog-node';

const DEFAULT_EU_HOST = 'https://eu.i.posthog.com';

let client: PostHog | null = null;

function getToken(): string | null {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    null
  );
}

function getHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_EU_HOST;
}

/**
 * Shared PostHog Node client for server-side captures (API routes, actions).
 * Flush on serverless responses when you need guaranteed delivery.
 */
export function getPostHogServerClient(): PostHog | null {
  const token = getToken();

  if (!token) {
    return null;
  }

  if (!client) {
    client = new PostHog(token, {
      host: getHost(),
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return client;
}

export async function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const ph = getPostHogServerClient();

  if (!ph) {
    return;
  }

  ph.capture({
    distinctId: params.distinctId,
    event: params.event,
    properties: params.properties,
  });

  await ph.flush();
}
