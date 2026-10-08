/** A property Rightmove holds for a branch, as far as we can read it. */
export type RightmoveBranchProperty = {
  reference: string;
  displayUrl: string | null;
};

/**
 * - `ozer`: Ozer is publishing it for a disposal that is on the market.
 * - `ozer_off_market`: an Ozer reference that should not be live, because the
 *   disposal is let, sold or withdrawn, or was taken off Rightmove in Ozer.
 * - `kato_copy`: an older copy of an Ozer disposal under its Kato reference.
 * - `unknown`: nothing in Ozer matches the reference.
 */
export type RightmoveBranchPropertyKind =
  | 'ozer'
  | 'ozer_off_market'
  | 'kato_copy'
  | 'unknown';

export type RightmoveAuditListing = {
  id: string;
  name: string;
  status: string;
};

export type RightmoveReferenceIndex = {
  /** Every reference Ozer publishes under, pointing at its disposal. */
  ozerReferences: Map<
    string,
    { listing: RightmoveAuditListing; intendedLive: boolean }
  >;
  /** Kato ids (commercial_listings.external_id), pointing at the disposal. */
  katoReferences: Map<string, RightmoveAuditListing>;
};

const REFERENCE_KEYS = new Set([
  'reference',
  'externalReference',
  'propertyReference',
  'agentReference',
]);

const COMMERCIAL_SELF_LINK = /^\/v2\/property\/commercial\//;
const DISPLAY_LINK = /^(https?:\/\/[^/]+)?\/(commercial-property|properties)\//;

function absoluteDisplayUrl(value: string): string {
  return value.startsWith('http')
    ? value
    : `https://www.rightmove.co.uk${value}`;
}

/**
 * Pull property references out of a branch listing response. Rightmove
 * documents the shape only loosely, so this collects any reference fields
 * and the reference-keyed link maps (`{ "REF": "/v2/property/commercial/1" }`).
 * Spaces inside a building are not separate listings and are skipped.
 */
export function extractRightmoveBranchProperties(
  json: unknown,
): RightmoveBranchProperty[] {
  const byReference = new Map<string, RightmoveBranchProperty>();

  const add = (reference: string, displayUrl: string | null) => {
    const ref = reference.trim();
    if (!ref) return;
    const existing = byReference.get(ref);
    if (existing) {
      if (!existing.displayUrl && displayUrl) existing.displayUrl = displayUrl;
      return;
    }
    byReference.set(ref, { reference: ref, displayUrl });
  };

  const walk = (value: unknown, parentKey: string | null) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, parentKey);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (parentKey === 'spaces') return;

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (REFERENCE_KEYS.has(key) && typeof child === 'string') {
        add(child, null);
        continue;
      }
      if (typeof child === 'string' && COMMERCIAL_SELF_LINK.test(child)) {
        add(key, null);
        continue;
      }
      if (
        typeof child === 'string' &&
        DISPLAY_LINK.test(child) &&
        parentKey === 'building'
      ) {
        add(key, absoluteDisplayUrl(child));
        continue;
      }
      walk(child, key);
    }
  };

  walk(json, null);
  return [...byReference.values()];
}

/** Total pages, when the response says. */
export function readRightmoveBranchTotalPages(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null;
  const row = json as Record<string, unknown>;
  const candidates = [
    row.totalPages,
    (row.page as Record<string, unknown> | undefined)?.totalPages,
    (row.meta as Record<string, unknown> | undefined)?.totalPages,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function classifyRightmoveReference(
  reference: string,
  index: RightmoveReferenceIndex,
): {
  kind: RightmoveBranchPropertyKind;
  listing: RightmoveAuditListing | null;
} {
  const ozer = index.ozerReferences.get(reference);
  if (ozer) {
    return {
      kind: ozer.intendedLive ? 'ozer' : 'ozer_off_market',
      listing: ozer.listing,
    };
  }
  const kato = index.katoReferences.get(reference);
  if (kato) return { kind: 'kato_copy', listing: kato };
  return { kind: 'unknown', listing: null };
}

/** Anything except a live Ozer listing is safe to offer for removal. */
export function rightmoveBranchPropertyRemovable(
  kind: RightmoveBranchPropertyKind,
): boolean {
  return kind !== 'ozer';
}
