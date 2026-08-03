export type NavSearchItem = {
  id: string;
  label: string;
  description?: string;
  category: string;
  href: string;
  keywords: string[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function scoreItem(query: string, item: NavSearchItem): number {
  const q = normalize(query);
  if (!q) return 1;

  const label = normalize(item.label);
  const shortLabel = normalize(item.label.split('—').pop() ?? item.label);
  const category = normalize(item.category);
  const keywords = item.keywords.map(normalize);
  const haystack = [
    label,
    shortLabel,
    category,
    item.description ?? '',
    ...keywords,
  ]
    .join(' ')
    .toLowerCase();

  if (shortLabel === q || label === q) return 100;
  if (shortLabel.startsWith(q) || label.startsWith(q)) return 90;
  if (shortLabel.includes(q) || label.includes(q)) return 75;
  if (keywords.some((k) => k === q || k.startsWith(q))) return 70;
  if (haystack.includes(q)) return 50;

  const tokens = q.split(' ').filter(Boolean);
  const overlap = tokens.filter((t) => haystack.includes(t)).length;
  if (overlap === 0) return 0;
  return 20 + overlap * 10;
}

/** Rank and filter navigation destinations for the command palette. */
export function filterNavCatalog(
  items: NavSearchItem[],
  query: string,
  limit = 12,
): NavSearchItem[] {
  const q = query.trim();
  if (!q) {
    return items.slice(0, limit);
  }

  return items
    .map((item) => ({ item, score: scoreItem(q, item) }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label),
    )
    .slice(0, limit)
    .map((row) => row.item);
}
