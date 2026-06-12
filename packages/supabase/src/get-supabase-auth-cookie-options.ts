import type { CookieOptions } from '@supabase/ssr';

function hostFromUrl(url: string | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeCookieDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed || trimmed.includes('localhost')) {
    return trimmed;
  }

  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function inferSharedCookieDomain(): string | undefined {
  const appHost = hostFromUrl(
    process.env.NEXT_PUBLIC_APP_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  );
  const marketingHost = hostFromUrl(process.env.NEXT_PUBLIC_MARKETING_SITE_URL);

  if (!appHost || !marketingHost || appHost === marketingHost) {
    return undefined;
  }

  const appParts = appHost.split('.');
  const marketingParts = marketingHost.split('.');

  if (appParts.length < 2 || marketingParts.length < 2) {
    return undefined;
  }

  const appApex = appParts.slice(-2).join('.');
  const marketingApex = marketingParts.slice(-2).join('.');

  if (appApex !== marketingApex || appApex.includes('localhost')) {
    return undefined;
  }

  return `.${appApex}`;
}

/**
 * When set (or inferred from app + marketing hosts), auth cookies are shared
 * across subdomains — required for app.keelos.so + www.keelos.so split.
 */
export function getSupabaseAuthCookieDomain(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN?.trim();

  if (explicit) {
    return normalizeCookieDomain(explicit);
  }

  return inferSharedCookieDomain();
}

export function getSupabaseAuthCookieOptions(): CookieOptions | undefined {
  const domain = getSupabaseAuthCookieDomain();

  if (!domain) {
    return undefined;
  }

  return {
    domain,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}
