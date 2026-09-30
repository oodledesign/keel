export type CanvasSearchEntry = {
  id: string;
  kind: string;
  label: string;
  /** Extra searchable text (body, role, file type…). */
  detail: string;
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function termScore(label: string, detail: string, term: string) {
  if (label === term) return 100;
  if (label.startsWith(term)) return 60;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}`).test(label)) return 40;
  if (label.includes(term)) return 25;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}`).test(detail)) return 12;
  if (detail.includes(term)) return 6;
  return 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every term must match somewhere; titles outrank body text. */
export function searchCanvasEntries(
  entries: CanvasSearchEntry[],
  query: string,
  limit = 30,
): CanvasSearchEntry[] {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored: Array<{ entry: CanvasSearchEntry; score: number }> = [];
  for (const entry of entries) {
    const label = normalise(entry.label);
    const detail = normalise(entry.detail);
    let score = 0;
    let matched = true;
    for (const term of terms) {
      const s = termScore(label, detail, term);
      if (s === 0) {
        matched = false;
        break;
      }
      score += s;
    }
    if (matched) scored.push({ entry, score: score - label.length / 1000 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}
