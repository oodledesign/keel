import { extractEmailAddress } from './address-utils';

/** Consumer / free-mail domains that should never auto-link by domain. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'fastmail.com',
  'hey.com',
]);

export function extractEmailDomain(
  value: string | null | undefined,
): string | null {
  const email = extractEmailAddress(value);

  if (!email) {
    return null;
  }

  const at = email.lastIndexOf('@');

  if (at < 0 || at === email.length - 1) {
    return null;
  }

  return email.slice(at + 1).toLowerCase();
}

/** Normalize a website hostname / URL to a bare domain (no www). */
export function normalizeWebsiteDomain(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) {
    return null;
  }

  let host = value.trim().toLowerCase();

  try {
    if (host.includes('://')) {
      host = new URL(host).hostname;
    } else if (host.includes('/')) {
      host = host.split('/')[0] ?? host;
    }
  } catch {
    return null;
  }

  host = host.replace(/^www\./, '').replace(/\.$/, '');

  if (!host || !host.includes('.')) {
    return null;
  }

  return host;
}

export function isPublicEmailDomain(
  domain: string | null | undefined,
): boolean {
  if (!domain) {
    return true;
  }

  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function domainsFromEmails(emails: string[]): string[] {
  const domains = new Set<string>();

  for (const email of emails) {
    const domain = extractEmailDomain(email);

    if (!domain || isPublicEmailDomain(domain)) {
      continue;
    }

    domains.add(domain);
  }

  return [...domains];
}

/**
 * Prefer preferredAccountId when multiple clients match; otherwise require
 * exactly one match overall.
 */
export function pickUniqueClientMatch<T extends { account_id: string }>(
  matches: T[],
  preferredAccountId?: string | null,
): T | null {
  if (matches.length === 0) {
    return null;
  }

  if (preferredAccountId) {
    const preferred = matches.filter(
      (match) => match.account_id === preferredAccountId,
    );

    if (preferred.length === 1) {
      return preferred[0]!;
    }

    if (preferred.length > 1) {
      return null;
    }
  }

  if (matches.length === 1) {
    return matches[0]!;
  }

  return null;
}
