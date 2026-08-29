import { ACTIVE_LISTING_STATUSES_FOR_MATCH } from '~/lib/commercial/match-scoring';

const DEFAULT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function listingBecameLiveForCirculation(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  const live = ACTIVE_LISTING_STATUSES_FOR_MATCH as readonly string[];
  const wasLive = Boolean(previousStatus && live.includes(previousStatus));
  const isLive = Boolean(nextStatus && live.includes(nextStatus));
  return isLive && !wasLive;
}

/** Stable id for “the same set of matching listings”. */
export function matchDigestFingerprint(listingIds: string[]): string {
  return [...new Set(listingIds.filter(Boolean))].sort().join(',');
}

export function shouldSkipSameDigest(input: {
  lastFingerprint: string | null | undefined;
  lastSentAt: string | null | undefined;
  nextFingerprint: string;
  now?: Date;
  cooldownMs?: number;
}): boolean {
  if (!input.nextFingerprint) return false;
  if (!input.lastFingerprint || !input.lastSentAt) return false;
  if (input.lastFingerprint !== input.nextFingerprint) return false;

  const sent = Date.parse(input.lastSentAt);
  if (Number.isNaN(sent)) return false;

  const now = (input.now ?? new Date()).getTime();
  const cooldown = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  return now - sent < cooldown;
}
