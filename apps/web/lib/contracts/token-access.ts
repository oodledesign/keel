/**
 * Pure gating rules for public (token-based) access to a contract, shared by
 * the portal page, `/api/contracts/pdf`, and the recipient-signing path.
 *
 * Kept dependency-free so it is cheap to unit test and so every access path
 * enforces exactly the same rule instead of re-implementing it ad hoc.
 */

/** Contract statuses that may be viewed/signed/downloaded via a public link. */
export const CONTRACT_PUBLICLY_VIEWABLE_STATUSES = [
  'ready_to_sign',
  'sent',
  'signed',
] as const;

export type ContractPubliclyViewableStatus =
  (typeof CONTRACT_PUBLICLY_VIEWABLE_STATUSES)[number];

export interface ContractTokenAccessInput {
  status: string | null | undefined;
  public_token_revoked_at?: string | null;
  public_token_expires_at?: string | null;
}

export type ContractTokenAccessDenialReason =
  | 'status'
  | 'revoked'
  | 'expired';

export interface ContractTokenAccessResult {
  accessible: boolean;
  reason: ContractTokenAccessDenialReason | null;
}

/**
 * Decide whether a contract is currently reachable via its public token.
 *
 * Rejects: draft and cancelled (and any status other than the viewable
 * set below), a revoked link, and an expired link. Only
 * ready_to_sign / sent / signed contracts with a non-revoked, non-expired
 * token (or no expiry set) are accessible.
 */
export function checkContractTokenAccess(
  contract: ContractTokenAccessInput,
  now: Date = new Date(),
): ContractTokenAccessResult {
  const status = contract.status ?? '';
  if (
    !CONTRACT_PUBLICLY_VIEWABLE_STATUSES.includes(
      status as ContractPubliclyViewableStatus,
    )
  ) {
    return { accessible: false, reason: 'status' };
  }

  if (contract.public_token_revoked_at) {
    return { accessible: false, reason: 'revoked' };
  }

  if (
    contract.public_token_expires_at &&
    new Date(contract.public_token_expires_at).getTime() <= now.getTime()
  ) {
    return { accessible: false, reason: 'expired' };
  }

  return { accessible: true, reason: null };
}

/** Convenience boolean wrapper around {@link checkContractTokenAccess}. */
export function isContractTokenAccessible(
  contract: ContractTokenAccessInput,
  now: Date = new Date(),
): boolean {
  return checkContractTokenAccess(contract, now).accessible;
}
