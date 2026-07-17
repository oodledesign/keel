export type NamedEntity = {
  id: string;
  name: string;
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function scoreMatch(query: string, candidate: string): number {
  const q = normalizeQuery(query);
  const c = normalizeQuery(candidate);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 80;
  if (c.includes(q)) return 60;
  if (q.includes(c)) return 40;
  const qTokens = q.split(' ');
  const cTokens = c.split(' ');
  const overlap = qTokens.filter((t) =>
    cTokens.some((ct) => ct.includes(t) || t.includes(ct)),
  );
  if (overlap.length > 0) return 20 + overlap.length * 5;
  return 0;
}

export function fuzzyMatchByName<T extends NamedEntity>(
  query: string,
  items: T[],
  limit = 5,
): Array<T & { score: number }> {
  const scored = items
    .map((item) => ({ ...item, score: scoreMatch(query, item.name) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function fuzzyMatchWorkspaceBySlugOrName<
  T extends { id: string; name: string; slug: string },
>(query: string, workspaces: T[]): T | null {
  const q = normalizeQuery(query);
  if (!q) return null;

  const exactSlug = workspaces.find((w) => normalizeQuery(w.slug) === q);
  if (exactSlug) return exactSlug;

  const exactName = workspaces.find((w) => normalizeQuery(w.name) === q);
  if (exactName) return exactName;

  const matches = fuzzyMatchByName(
    query,
    workspaces.map((w) => ({ id: w.id, name: `${w.name} ${w.slug}` })),
    1,
  );
  if (matches.length === 0) return null;

  const bestId = matches[0]!.id;
  return workspaces.find((w) => w.id === bestId) ?? null;
}

export function mapNameToId(
  name: string | null | undefined,
  rows: NamedEntity[],
): string | null {
  if (!name?.trim()) return null;
  const match = fuzzyMatchByName(name, rows, 1)[0];
  return match?.id ?? null;
}
