import { z } from 'zod';

const MONITORING_PROVIDERS = [
  'sentry',
  '',
  // Add more providers here
] as const;

export const MONITORING_PROVIDER = z
  .enum(MONITORING_PROVIDERS, {
    errorMap: () => ({ message: 'Invalid monitoring provider' }),
  })
  .optional()
  .transform((value) => value || undefined);

export type MonitoringProvider = z.infer<typeof MONITORING_PROVIDER>;

export function getMonitoringProvider() {
  const provider = MONITORING_PROVIDER.safeParse(
    process.env.NEXT_PUBLIC_MONITORING_PROVIDER,
  );

  if (!provider.success) {
    console.error(
      `Error: Invalid monitoring provider\n\n${provider.error.message}.\n\nWill fallback to console service.\nPlease review the variable NEXT_PUBLIC_MONITORING_PROVIDER`,
    );

    return;
  }

  return provider.data;
}
