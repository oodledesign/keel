/**
 * Pure helpers for discovering icon URLs from HTML / well-known paths.
 * Kept free of `server-only` so unit tests can import them.
 */

export type IconCandidate = {
  href: string;
  score: number;
};

/** True for IPv4/IPv6 addresses that must not be fetched (SSRF). */
export function isPrivateOrReservedIp(address: string): boolean {
  const value = address.trim().toLowerCase();

  if (value.includes(':')) {
    // IPv6: loopback, link-local, unique-local, IPv4-mapped private.
    if (
      value === '::1' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe80:')
    ) {
      return true;
    }
    const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped?.[1]) return isPrivateOrReservedIp(mapped[1]);
    return false;
  }

  const parts = value.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return true;
  }

  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function isBlockedLogoHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.intranet') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  // Block literal IPs (SSRF hygiene for user-supplied domains).
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    return true;
  }

  return false;
}

export function resolveIconUrlAgainstBase(
  href: string,
  baseUrl: string,
): string | null {
  try {
    const resolved = new URL(href, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    if (isBlockedLogoHostname(resolved.hostname)) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function sizeScoreFromSizesAttr(sizes: string | undefined): number {
  if (!sizes || sizes.trim().toLowerCase() === 'any') return 0;

  let best = 0;
  for (const part of sizes.trim().split(/\s+/)) {
    const match = /^(\d+)x(\d+)$/i.exec(part);
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    best = Math.max(best, Math.min(width, height));
  }
  return best;
}

/**
 * Parse <link rel="apple-touch-icon|icon|…"> tags from HTML.
 * Higher score = preferred (apple-touch + larger sizes first).
 */
export function extractIconCandidatesFromHtml(
  html: string,
  baseUrl: string,
): string[] {
  const candidates: IconCandidate[] = [];
  const linkTagRe = /<link\b[^>]*>/gi;

  for (const match of html.matchAll(linkTagRe)) {
    const tag = match[0] ?? '';
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rel || !href) continue;

    const relTokens = rel.split(/\s+/);
    const isApple = relTokens.some((token) =>
      token.includes('apple-touch-icon'),
    );
    const isIcon =
      relTokens.includes('icon') ||
      relTokens.includes('shortcut') ||
      relTokens.includes('shortcut-icon');

    if (!isApple && !isIcon) continue;

    const resolved = resolveIconUrlAgainstBase(href, baseUrl);
    if (!resolved) continue;

    const sizes = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i)?.[1];
    let score = sizeScoreFromSizesAttr(sizes);
    if (isApple) {
      // Prefer apple-touch / webclip over tiny favicons.
      score += 1000;
      if (score < 1180) score = 1180; // typical 180x180 when sizes omitted
    }

    candidates.push({ href: resolved, score });
  }

  candidates.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.href)) continue;
    seen.add(candidate.href);
    ordered.push(candidate.href);
  }
  return ordered;
}

export function wellKnownIconUrls(origin: string): string[] {
  return [
    `${origin}/apple-touch-icon.png`,
    `${origin}/apple-touch-icon-precomposed.png`,
    `${origin}/apple-touch-icon.jpg`,
    `${origin}/favicon-32x32.png`,
    `${origin}/favicon-96x96.png`,
    `${origin}/favicon.png`,
    `${origin}/favicon.ico`,
  ];
}

export function googleFaviconUrl(domain: string, size: number): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
