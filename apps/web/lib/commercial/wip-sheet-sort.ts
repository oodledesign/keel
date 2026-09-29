/**
 * Column sorting for the WIP sheet. No active sort means "by stage": the
 * shared manual order used by the ladder and board.
 */

export type SheetSortDirection = 'asc' | 'desc';

export type SheetSort = { key: string; direction: SheetSortDirection };

export type SheetSortValue = string | number | boolean | null | undefined;

/** Click cycle for a column: off -> ascending -> descending -> off. */
export function nextSheetSort(
  current: SheetSort | null,
  key: string,
): SheetSort | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

function isBlank(value: SheetSortValue): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

const collator = new Intl.Collator('en-GB', {
  numeric: true,
  sensitivity: 'base',
});

function compareValues(a: SheetSortValue, b: SheetSortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(Boolean(a)) - Number(Boolean(b));
  }
  return collator.compare(String(a), String(b));
}

/**
 * Stable sort by one column. Blank values always sit last, whichever way the
 * column is sorted, so empty cells never crowd the top of a descending sort.
 * `fallback` breaks ties (normally the shared manual order).
 */
export function sortSheetRows<T>(
  rows: readonly T[],
  sort: SheetSort,
  getValue: (row: T) => SheetSortValue,
  fallback: (a: T, b: T) => number,
): T[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);
    const aBlank = isBlank(aValue);
    const bBlank = isBlank(bValue);
    if (aBlank !== bBlank) return aBlank ? 1 : -1;
    if (!aBlank && !bBlank) {
      const result = compareValues(aValue, bValue);
      if (result !== 0) return result * sign;
    }
    return fallback(a, b);
  });
}
