import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_MONITORING_PROVIDER === 'sentry') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
      process.env.NEXT_PUBLIC_VERCEL_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
