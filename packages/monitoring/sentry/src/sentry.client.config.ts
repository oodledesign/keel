import { getClient, init } from '@sentry/nextjs';

/**
 * @name initializeSentryBrowserClient
 * @description Initialize the Sentry client
 * @param props
 */
export function initializeSentryBrowserClient(
  props: Parameters<typeof init>[0] = {},
) {
  // Eager Next.js init (instrumentation-client.ts) owns the primary client.
  if (getClient()) {
    return getClient();
  }

  return init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate:
      props?.tracesSampleRate ??
      (process.env.NODE_ENV === 'development' ? 1.0 : 0.1),
    ...props,
  });
}
