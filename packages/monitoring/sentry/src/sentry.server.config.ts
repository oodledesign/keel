import { getClient, init } from '@sentry/nextjs';

/**
 * @name initializeSentryServerClient
 * @description Initialize the Sentry client in the server
 * @param props
 */
export function initializeSentryServerClient(
  props: Parameters<typeof init>[0] = {},
) {
  // Eager Next.js init (sentry.server.config.ts) owns the primary client.
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
