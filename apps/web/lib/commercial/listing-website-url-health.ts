import { isBlockedLogoHostname } from '~/lib/clients/client-logo-icons';
import { isPublicListingPageUrl } from '~/lib/commercial/listing-website-url';

export const WEBSITE_URL_HEALTH_TIMEOUT_MS = 4_000;
export const WEBSITE_URL_HEALTH_MAX_REDIRECTS = 3;

export type WebsiteUrlHealthReason =
  | 'ok'
  | 'http_error'
  | 'unsafe_url'
  | 'unsafe_redirect'
  | 'timeout'
  | 'network'
  | 'skipped';

export type WebsiteUrlHealth = {
  url: string;
  ok: boolean;
  status: number | null;
  reason: WebsiteUrlHealthReason;
};

const BROKEN_STATUSES = new Set([404, 410]);

export function isSafePublicProbeHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  // Literal IPs and localhost-style hosts are blocked here; resolved
  // addresses are checked separately after DNS.
  return !isBlockedLogoHostname(host);
}

export function isSafePublicProbeUrl(value: string): boolean {
  if (!isPublicListingPageUrl(value)) return false;
  try {
    return isSafePublicProbeHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

/** Soft Website warning: confirmed missing/gone public page. */
export function isWebsitePublicPageBroken(
  healthResult: WebsiteUrlHealth | null | undefined,
): boolean {
  if (!healthResult || healthResult.ok) return false;
  if (healthResult.reason !== 'http_error') return false;
  return (
    healthResult.status != null && BROKEN_STATUSES.has(healthResult.status)
  );
}

export function websiteBrokenStatusLabel(
  healthResult: WebsiteUrlHealth,
): string {
  return `Live but link broken (${healthResult.status ?? 'error'})`;
}
