import 'server-only';

export type PropertyMatchRow = {
  id: string;
  name: string;
  address?: string | null;
};

function normalizePropertyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function propertyTokens(value: string): string[] {
  const normalized = normalizePropertyText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 2);
}

/** Best-effort match of a bank reference (often an address) to a property. */
export function matchPropertyFromReference(
  reference: string,
  properties: PropertyMatchRow[],
): string | null {
  const refNorm = normalizePropertyText(reference);
  if (!refNorm || properties.length === 0) return null;

  let best: { id: string; score: number } | null = null;

  for (const property of properties) {
    const candidates = [property.name, property.address ?? ''].filter(Boolean);
    for (const candidate of candidates) {
      const candidateNorm = normalizePropertyText(candidate);
      if (!candidateNorm) continue;

      if (refNorm === candidateNorm) {
        return property.id;
      }

      if (
        refNorm.includes(candidateNorm) ||
        candidateNorm.includes(refNorm)
      ) {
        const score = Math.min(refNorm.length, candidateNorm.length);
        if (!best || score > best.score) {
          best = { id: property.id, score };
        }
        continue;
      }

      const refTokens = propertyTokens(reference);
      const candidateTokens = propertyTokens(candidate);
      if (refTokens.length === 0 || candidateTokens.length === 0) continue;

      const overlap = refTokens.filter((token) =>
        candidateTokens.some(
          (candidateToken) =>
            candidateToken.includes(token) || token.includes(candidateToken),
        ),
      ).length;

      if (overlap >= 2) {
        const score = overlap * 10;
        if (!best || score > best.score) {
          best = { id: property.id, score };
        }
      }
    }
  }

  return best?.id ?? null;
}
