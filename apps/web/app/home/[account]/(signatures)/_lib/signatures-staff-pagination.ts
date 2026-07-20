export const SIGNATURES_STAFF_PAGE_SIZES = [25, 50, 100] as const;

export type SignaturesStaffPageSize =
  (typeof SIGNATURES_STAFF_PAGE_SIZES)[number];

export const DEFAULT_SIGNATURES_STAFF_PAGE_SIZE =
  SIGNATURES_STAFF_PAGE_SIZES[1];

export const SIGNATURES_DASHBOARD_STAFF_PAGE_SIZE = 8;

export function parseStaffListPage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function parseStaffListPageSize(
  value: string | undefined,
  fallback: number = DEFAULT_SIGNATURES_STAFF_PAGE_SIZE,
) {
  const size = Number.parseInt(value ?? String(fallback), 10);
  return (SIGNATURES_STAFF_PAGE_SIZES as readonly number[]).includes(size)
    ? (size as SignaturesStaffPageSize)
    : fallback;
}
