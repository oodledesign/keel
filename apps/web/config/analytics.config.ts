import { z } from 'zod';

const AnalyticsConfigSchema = z.object({
  marketingMeasurementId: z.string().min(1).optional(),
  appMeasurementId: z.string().min(1).optional(),
});

const analyticsConfig = AnalyticsConfigSchema.parse({
  marketingMeasurementId:
    process.env.NEXT_PUBLIC_GA_MARKETING_ID?.trim() || 'G-GGYHJP7R9B',
  appMeasurementId:
    process.env.NEXT_PUBLIC_GA_APP_ID?.trim() || 'G-55WVBMQWN0',
});

export default analyticsConfig;

const APP_PATH_PREFIXES = [
  '/home',
  '/app',
  '/admin',
  '/portal',
  '/onboarding',
  '/auth',
] as const;

function hostFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Pick marketing vs app GA property from hostname and path. */
export function resolveGoogleAnalyticsMeasurementId(
  pathname: string,
  hostname: string,
): string | null {
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_SITE_URL?.replace(/\/+$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  const appHost = appOrigin ? hostFromOrigin(appOrigin) : null;
  const normalizedHost = hostname.toLowerCase();
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  const isAppHost =
    (appHost && normalizedHost === appHost) || normalizedHost.startsWith('app.');

  const isAppPath = APP_PATH_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );

  if (isAppHost || isAppPath) {
    return analyticsConfig.appMeasurementId ?? null;
  }

  return analyticsConfig.marketingMeasurementId ?? null;
}
