/**
 * Shared defaults for contract public-token lifetime. Pulled out as a pure
 * helper so the "how long is a freshly issued link valid for" decision is
 * made once and is unit-testable.
 */

/** Default validity window for a newly issued/rotated contract public token. */
export const CONTRACT_PUBLIC_TOKEN_TTL_DAYS = 90;

/** ISO timestamp `CONTRACT_PUBLIC_TOKEN_TTL_DAYS` days after `from`. */
export function computeContractPublicTokenExpiry(
  from: Date = new Date(),
  ttlDays: number = CONTRACT_PUBLIC_TOKEN_TTL_DAYS,
): string {
  const expires = new Date(from.getTime());
  expires.setUTCDate(expires.getUTCDate() + Math.max(1, Math.round(ttlDays)));
  return expires.toISOString();
}
