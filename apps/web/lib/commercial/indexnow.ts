import { randomBytes } from 'node:crypto';

import { isBlockedLogoHostname } from '~/lib/clients/client-logo-icons';
import {
  isPublicListingPageUrl,
  publicOriginFromHttpUrl,
  publicOriginFromListingUrlTemplate,
} from '~/lib/commercial/listing-website-url';

/** Stored on property_hive commercial_portal_credentials.metadata. */
export const INDEXNOW_KEY_META_KEY = 'indexnow_key';

/** Shared IndexNow endpoint (Bing and other participants). */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Same URL is not submitted again until this window passes after a failed
 * attempt. A successful submit is remembered until the URL changes.
 */
export const INDEXNOW_RETRY_AFTER_MS = 15 * 60 * 1000;

export type IndexNowState = {
  /** Last URL IndexNow accepted (200 or 202). */
  url?: string;
  submittedAt?: string;
  /** Last URL we attempted, including failures. */
  attemptUrl?: string;
  attemptAt?: string;
};

export type IndexNowSubmission = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

export type IndexNowSkipReason =
  | 'not_on_market'
  | 'website_excluded'
  | 'no_key'
  | 'no_host'
  | 'url_not_eligible'
  | 'already_submitted'
  | 'recent_attempt';

export type IndexNowPlan =
  | { action: 'submit'; url: string; submission: IndexNowSubmission }
  | { action: 'skip'; reason: IndexNowSkipReason };

const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

/** 32 hex chars — within IndexNow's 8–128 key charset. */
export function generateIndexNowKey(): string {
  return randomBytes(16).toString('hex');
}

export function isValidIndexNowKey(value: string | null | undefined): boolean {
  const key = value?.trim() ?? '';
  return KEY_PATTERN.test(key);
}

export function parseIndexNowState(value: unknown): IndexNowState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const read = (key: keyof IndexNowState) => {
    const raw = record[key];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  };
  return {
    url: read('url'),
    submittedAt: read('submittedAt'),
    attemptUrl: read('attemptUrl'),
    attemptAt: read('attemptAt'),
  };
}

/**
 * Host that must serve `{key}.txt`. Listing URL template wins over the
 * Property Hive site URL because that is the public page host.
 * HTTP origins are rejected — IndexNow key files for these listings are https.
 */
export function resolveIndexNowWebsiteHost(input: {
  listingUrlTemplate?: string | null;
  siteUrl?: string | null;
}): string | null {
  const origin =
    publicOriginFromListingUrlTemplate(input.listingUrlTemplate) ??
    publicOriginFromHttpUrl(input.siteUrl);
  if (!origin || !origin.startsWith('https://')) return null;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (!host || isBlockedLogoHostname(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function indexNowKeyLocation(host: string, key: string): string {
  return `https://${host}/${key}.txt`;
}

/**
 * Absolute https listing page on the configured website host.
 * Returns the canonical href IndexNow should receive.
 */
export function indexNowEligibleListingUrl(
  value: string | null | undefined,
  websiteHost: string,
): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || !isPublicListingPageUrl(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port && parsed.port !== '443') return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== websiteHost.toLowerCase()) return null;
  if (isBlockedLogoHostname(host)) return null;
  return parsed.href;
}

export function buildIndexNowPlan(input: {
  websiteUrl?: string | null;
  onMarket: boolean;
  websiteFeedIncluded: boolean;
  key?: string | null;
  listingUrlTemplate?: string | null;
  siteUrl?: string | null;
  state?: IndexNowState | null;
  now?: Date;
  retryAfterMs?: number;
}): IndexNowPlan {
  if (!input.onMarket) return { action: 'skip', reason: 'not_on_market' };
  if (!input.websiteFeedIncluded) {
    return { action: 'skip', reason: 'website_excluded' };
  }

  const key = input.key?.trim() ?? '';
  if (!isValidIndexNowKey(key)) return { action: 'skip', reason: 'no_key' };

  const host = resolveIndexNowWebsiteHost({
    listingUrlTemplate: input.listingUrlTemplate,
    siteUrl: input.siteUrl,
  });
  if (!host) return { action: 'skip', reason: 'no_host' };

  const url = indexNowEligibleListingUrl(input.websiteUrl, host);
  if (!url) return { action: 'skip', reason: 'url_not_eligible' };

  const state = input.state ?? {};
  if (state.url === url) {
    return { action: 'skip', reason: 'already_submitted' };
  }

  const retryAfterMs = input.retryAfterMs ?? INDEXNOW_RETRY_AFTER_MS;
  const attemptAt = state.attemptAt ? Date.parse(state.attemptAt) : Number.NaN;
  const now = input.now ?? new Date();
  if (
    state.attemptUrl === url &&
    Number.isFinite(attemptAt) &&
    now.getTime() - attemptAt < retryAfterMs
  ) {
    return { action: 'skip', reason: 'recent_attempt' };
  }

  return {
    action: 'submit',
    url,
    submission: {
      host,
      key,
      keyLocation: indexNowKeyLocation(host, key),
      urlList: [url],
    },
  };
}

export function indexNowStateAfterAttempt(input: {
  previous: IndexNowState;
  url: string;
  ok: boolean;
  at: Date;
}): IndexNowState {
  const at = input.at.toISOString();
  if (!input.ok) {
    return {
      ...input.previous,
      attemptUrl: input.url,
      attemptAt: at,
    };
  }
  return {
    url: input.url,
    submittedAt: at,
    attemptUrl: input.url,
    attemptAt: at,
  };
}

export async function postIndexNowSubmission(
  submission: IndexNowSubmission,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      host: submission.host,
      key: submission.key,
      keyLocation: submission.keyLocation,
      urlList: submission.urlList,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  let body = '';
  try {
    body = (await response.text()).slice(0, 300);
  } catch {
    body = '';
  }
  return {
    ok: response.status === 200 || response.status === 202,
    status: response.status,
    body,
  };
}
