import type { NavSearchItem } from '~/lib/quick-action/filter-nav-catalog';

export type SearchHistoryItem = Pick<
  NavSearchItem,
  'id' | 'label' | 'href' | 'category'
>;

const STORAGE_KEY = 'ozer-workspace-search-history-v1';
const MAX_ITEMS = 8;

export function loadSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is SearchHistoryItem =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as SearchHistoryItem).id === 'string' &&
          typeof (item as SearchHistoryItem).label === 'string' &&
          typeof (item as SearchHistoryItem).href === 'string',
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function pushSearchHistory(item: SearchHistoryItem): SearchHistoryItem[] {
  const next = [
    item,
    ...loadSearchHistory().filter(
      (entry) => entry.id !== item.id && entry.href !== item.href,
    ),
  ].slice(0, MAX_ITEMS);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode failures.
  }

  return next;
}
