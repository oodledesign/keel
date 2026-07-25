/**
 * Helpers for resolving a company domain for logo lookup.
 */

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
  'hey.com',
]);

/** Normalize a user-entered domain or URL to a bare hostname. */
export function normalizeDomainInput(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (candidate.includes('://')) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  } else if (candidate.includes('/') || candidate.includes(' ')) {
    try {
      candidate = new URL(`https://${candidate}`).hostname;
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/^www\./, '').replace(/\.$/, '');

  if (
    !candidate ||
    candidate.includes('@') ||
    !candidate.includes('.') ||
    candidate.length > 253
  ) {
    return null;
  }

  // Basic hostname shape: labels with letters/digits/hyphens.
  if (!/^[a-z0-9.-]+$/.test(candidate)) {
    return null;
  }

  return candidate;
}

export function domainFromEmail(
  email: string | null | undefined,
): string | null {
  const value = email?.trim().toLowerCase();
  if (!value || !value.includes('@')) return null;

  const domain = value.split('@').pop()?.trim() ?? '';
  const normalized = normalizeDomainInput(domain);
  if (!normalized) return null;
  if (FREE_EMAIL_DOMAINS.has(normalized)) return null;
  return normalized;
}

export function resolveClientLogoDomain(input: {
  domain?: string | null;
  website?: string | null;
  email?: string | null;
}): string | null {
  const fromInput = input.domain ? normalizeDomainInput(input.domain) : null;
  if (fromInput) return fromInput;
  const fromWebsite = input.website
    ? normalizeDomainInput(input.website)
    : null;
  if (fromWebsite) return fromWebsite;
  return domainFromEmail(input.email);
}

/** Build an absolute URL for linking a stored website/domain value. */
export function websiteHref(website: string | null | undefined): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
