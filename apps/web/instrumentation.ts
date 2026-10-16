/**
 * This file is used to register monitoring instrumentation
 * for your Next.js application.
 */
import { type Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_PUBLIC_MONITORING_PROVIDER === 'sentry') {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config');
    }
  }

  const { registerMonitoringInstrumentation } =
    await import('@kit/monitoring/instrumentation');

  await registerMonitoringInstrumentation();

  const { registerOzerBillingPolicies } =
    await import('~/lib/billing/register-ozer-policies');
  registerOzerBillingPolicies();
}

/**
 * @name onRequestError
 * @description This function is called when an error occurs during the request lifecycle.
 * It is used to capture the error and send it to the monitoring service.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_PUBLIC_MONITORING_PROVIDER === 'sentry') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureRequestError(err, request, context);
    return;
  }

  const { getServerMonitoringService } = await import('@kit/monitoring/server');

  const service = await getServerMonitoringService();

  await service.ready();

  await service.captureException(
    err as Error,
    {},
    {
      path: request.path,
      headers: request.headers,
      method: request.method,
      routePath: context.routePath,
    },
  );
};
