import 'server-only';

/**
 * Shared Mapbox token resolution for server-side brochure work
 * (static maps + nearby amenity geocoding).
 *
 * Prefer MAPBOX_SECRET_TOKEN — an unrestricted pk.… or sk.… with geocoding
 * scopes. NEXT_PUBLIC_MAPBOX_TOKEN is often URL-restricted for the client
 * disposals map and returns 401/403 when fetched from the server / Vercel.
 */

export type MapboxTokenSource =
  | 'MAPBOX_SECRET_TOKEN'
  | 'MAPBOX_ACCESS_TOKEN'
  | 'MAPBOX_TOKEN'
  | 'NEXT_PUBLIC_MAPBOX_TOKEN';

export type ResolvedMapboxToken = {
  token: string;
  source: MapboxTokenSource;
};

const TOKEN_SOURCES: MapboxTokenSource[] = [
  'MAPBOX_SECRET_TOKEN',
  'MAPBOX_ACCESS_TOKEN',
  'MAPBOX_TOKEN',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
];

function readToken(source: MapboxTokenSource): string | null {
  const value = process.env[source]?.trim();
  return value || null;
}

/** Every distinct token in preference order (secret → public). */
export function listMapboxTokens(): ResolvedMapboxToken[] {
  const seen = new Set<string>();
  const tokens: ResolvedMapboxToken[] = [];

  for (const source of TOKEN_SOURCES) {
    const token = readToken(source);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push({ token, source });
  }

  return tokens;
}

export function resolveMapboxToken(): ResolvedMapboxToken | null {
  return listMapboxTokens()[0] ?? null;
}

export function isPublicMapboxTokenSource(source: MapboxTokenSource): boolean {
  return source === 'NEXT_PUBLIC_MAPBOX_TOKEN';
}

export function logMapboxServerAuthFailure(
  source: MapboxTokenSource,
  status: number,
  context: string,
): void {
  console.error(
    `[brochure-pdf] ${context} Mapbox ${status}`,
    `tokenSource=${source}`,
    `tokenIsPublic=${isPublicMapboxTokenSource(source)}`,
  );

  if (isPublicMapboxTokenSource(source)) {
    console.error(
      '[brochure-pdf] Hint: NEXT_PUBLIC_MAPBOX_TOKEN may have URL restrictions that block server-side fetches. Add MAPBOX_SECRET_TOKEN (sk.… or unrestricted pk.…) in Vercel for brochure PDFs.',
    );
    return;
  }

  console.error(
    '[brochure-pdf] Hint: this server Mapbox token was rejected. Set MAPBOX_SECRET_TOKEN to an unrestricted pk.… or sk.… with geocoding/static scopes (URL-restricted public tokens fail from Vercel).',
  );
}
