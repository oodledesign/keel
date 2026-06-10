import 'server-only';

export type FreeAgentCategoryRecord = Record<string, unknown> & {
  url?: string;
  description?: string;
  name?: string;
  group_description?: string;
  nominal_code?: string | number;
  group?: string;
  category_group?: string;
  /** Set when flattening grouped API responses. */
  _faGroupKey?: string;
  _defaultKind?: 'income' | 'expense';
};

const FA_CATEGORY_GROUPS = [
  { key: 'income_categories', defaultKind: 'income' as const },
  { key: 'admin_expenses_categories', defaultKind: 'expense' as const },
  { key: 'cost_of_sales_categories', defaultKind: 'expense' as const },
  { key: 'general_categories', defaultKind: null },
] as const;

function kindFromNominalCode(code: unknown): 'income' | 'expense' | null {
  const n = parseInt(String(code ?? ''), 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 49) return 'income';
  return 'expense';
}

export function flattenFreeAgentCategoriesResponse(
  data: Record<string, unknown>,
): FreeAgentCategoryRecord[] {
  if (Array.isArray(data.categories)) {
    return data.categories as FreeAgentCategoryRecord[];
  }

  const results: FreeAgentCategoryRecord[] = [];
  const seenUrls = new Set<string>();

  for (const { key, defaultKind } of FA_CATEGORY_GROUPS) {
    const items = data[key];
    if (!Array.isArray(items)) continue;

    for (const raw of items) {
      const item = raw as FreeAgentCategoryRecord;
      const url = String(item.url ?? '').trim();
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const kind =
        defaultKind ??
        kindFromNominalCode(item.nominal_code) ??
        'expense';

      results.push({
        ...item,
        _faGroupKey: key,
        group: key.replace(/_categories$/, '').replace(/_/g, ' '),
        category_group: String(item.group_description ?? key),
        _defaultKind: kind,
      });
    }
  }

  return results;
}

export function freeAgentCategoryKind(
  cat: FreeAgentCategoryRecord,
): 'income' | 'expense' {
  if (cat._defaultKind === 'income') return 'income';
  if (cat._defaultKind === 'expense') return 'expense';

  const fromNominal = kindFromNominalCode(cat.nominal_code);
  if (fromNominal) return fromNominal;

  const group = String(
    cat.group ?? cat.category_group ?? cat.group_description ?? '',
  ).toLowerCase();

  if (
    group.includes('income') ||
    group.includes('sales') ||
    group.includes('revenue')
  ) {
    return 'income';
  }

  return 'expense';
}

export function freeAgentCategoryDisplayName(cat: FreeAgentCategoryRecord): string {
  return String(cat.description ?? cat.name ?? 'Category').trim();
}
