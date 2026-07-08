export const FINANCE_TRANSACTION_PAGE_SIZES = [50, 100, 200] as const;

export type FinanceTransactionPageSize =
  (typeof FINANCE_TRANSACTION_PAGE_SIZES)[number];

export const DEFAULT_FINANCE_PAGE_SIZE = FINANCE_TRANSACTION_PAGE_SIZES[0];
