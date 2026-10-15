/**
 * Resolve the display name used in emails and {{account.name}}.
 * Prefer trading_name when set; otherwise the workspace name.
 */
export function resolveTradingOrAccountName(input: {
  tradingName?: string | null;
  accountName?: string | null;
  fallback?: string | null;
}): string {
  const trading = input.tradingName?.trim();
  if (trading) return trading;
  const account = input.accountName?.trim();
  if (account) return account;
  return input.fallback?.trim() || '';
}
