import {
  isBlockedLogoHostname,
  isPrivateOrReservedIp,
} from '~/lib/clients/client-logo-icons';
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

export type WebsiteUrlProbeDeps = {
  fetch?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
};

const BROKEN_STATUSES = new Set([404, 410]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HEAD_FALLBACK_STATUSES = new Set([405, 501]);

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

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises');
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
}

async function assertHostSafeToFetch(
  hostname: string,
  resolveHost: (hostname: string) => Promise<string[]>,
): Promise<boolean> {
  if (!isSafePublicProbeHostname(hostname)) return false;
  try {
    const addresses = await resolveHost(hostname);
    if (addresses.length === 0) return false;
    return addresses.every((address) => !isPrivateOrReservedIp(address));
  } catch {
    return false;
  }
}

function health(
  url: string,
  partial: Omit<WebsiteUrlHealth, 'url'>,
): WebsiteUrlHealth {
  return { url, ...partial };
}

/**
 * HEAD (then GET if needed) a public listing page. Does not follow redirects
 * onto blocked or private hosts. Timeouts and network failures are skipped so
 * a flaky remote site does not turn the Website channel orange.
 */
export async function probePublicListingPageUrl(
  url: string,
  deps: WebsiteUrlProbeDeps = {},
): Promise<WebsiteUrlHealth> {
  const fetchImpl = deps.fetch ?? fetch;
  const resolveHost = deps.resolveHost ?? defaultResolveHost;

  if (!isSafePublicProbeUrl(url)) {
    return health(url, {
      ok: false,
      status: null,
      reason: 'unsafe_url',
    });
  }

  let currentUrl = url;

  try {
    for (let hop = 0; hop <= WEBSITE_URL_HEALTH_MAX_REDIRECTS; hop += 1) {
      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return health(url, {
          ok: false,
          status: null,
          reason: 'unsafe_url',
        });
      }

      if (!(await assertHostSafeToFetch(parsed.hostname, resolveHost))) {
        return health(url, {
          ok: false,
          status: null,
          reason: hop === 0 ? 'unsafe_url' : 'unsafe_redirect',
        });
      }

      const signal = AbortSignal.timeout(WEBSITE_URL_HEALTH_TIMEOUT_MS);
      const headers = {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'OzerPublishingHealth/1.0',
      };

      let response = await fetchImpl(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers,
        signal,
        cache: 'no-store',
      });

      if (HEAD_FALLBACK_STATUSES.has(response.status)) {
        response = await fetchImpl(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers,
          signal,
          cache: 'no-store',
        });
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location || hop === WEBSITE_URL_HEALTH_MAX_REDIRECTS) {
          return health(url, {
            ok: false,
            status: response.status,
            reason: 'unsafe_redirect',
          });
        }
        currentUrl = new URL(location, currentUrl).toString();
        if (!isSafePublicProbeUrl(currentUrl)) {
          return health(url, {
            ok: false,
            status: response.status,
            reason: 'unsafe_redirect',
          });
        }
        continue;
      }

      if (response.ok) {
        return health(url, {
          ok: true,
          status: response.status,
          reason: 'ok',
        });
      }

      return health(url, {
        ok: false,
        status: response.status,
        reason: 'http_error',
      });
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return health(url, { ok: false, status: null, reason: 'timeout' });
    }
    return health(url, { ok: false, status: null, reason: 'network' });
  }

  return health(url, { ok: false, status: null, reason: 'network' });
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
