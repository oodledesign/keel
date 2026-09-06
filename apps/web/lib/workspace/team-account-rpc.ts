/**
 * PostgREST may return RETURNS public.accounts as an object or a one-row array
 * depending on schema-cache / Accept headers. Always read a single row.
 */
export function readTeamAccountFromRpc(data: unknown): {
  id?: string;
  slug?: string | null;
} | null {
  if (!data) {
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return null;
  }

  const record = row as { id?: unknown; slug?: unknown };
  const id = typeof record.id === 'string' ? record.id : undefined;
  const slug = typeof record.slug === 'string' ? record.slug : null;

  if (!id && !slug) {
    return null;
  }

  return { id, slug };
}

export function slugifyWorkspaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function uniqueWorkspaceSlug(
  lookup: (table: 'accounts' | 'businesses', slug: string) => Promise<boolean>,
  base: string,
): Promise<string> {
  const root = base || 'workspace';
  let candidate = root;
  let n = 0;

  for (;;) {
    const [accountTaken, businessTaken] = await Promise.all([
      lookup('accounts', candidate),
      lookup('businesses', candidate),
    ]);

    if (!accountTaken && !businessTaken) {
      return candidate;
    }

    n += 1;
    candidate = `${root}-${n}`;
  }
}
