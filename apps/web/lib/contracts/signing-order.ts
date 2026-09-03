/**
 * Sequential multi-party signing helpers.
 *
 * Author (role=author) typically signs in the dashboard first; portal
 * signers (role=signer) may only sign when every earlier party has
 * already signed. Kept pure so the portal and service share one rule.
 */

export type ContractSignerRole = 'author' | 'signer';

export interface ContractSignerLike {
  id: string;
  signing_order: number;
  role: ContractSignerRole | string;
  name?: string | null;
  email?: string | null;
  signed_at?: string | null;
}

export type SignerTurnDenialReason =
  | 'unknown_signer'
  | 'already_signed'
  | 'waiting_on_earlier_party'
  | 'signing_expired';

export interface SignerTurnResult {
  ok: boolean;
  reason: SignerTurnDenialReason | null;
  waitingOn: ContractSignerLike | null;
}

export function sortSignersByOrder<T extends ContractSignerLike>(
  signers: readonly T[],
): T[] {
  return [...signers].sort((a, b) => a.signing_order - b.signing_order);
}

/** First signer (by order) who has not yet signed, or null if complete. */
export function nextUnsignedSigner<T extends ContractSignerLike>(
  signers: readonly T[],
): T | null {
  return sortSignersByOrder(signers).find((signer) => !signer.signed_at) ?? null;
}

export function allSignersComplete(signers: readonly ContractSignerLike[]): boolean {
  if (signers.length === 0) return false;
  return signers.every((signer) => Boolean(signer.signed_at));
}

export function canSignerSign(
  signers: readonly ContractSignerLike[],
  signerId: string,
): SignerTurnResult {
  const ordered = sortSignersByOrder(signers);
  const target = ordered.find((signer) => signer.id === signerId);
  if (!target) {
    return { ok: false, reason: 'unknown_signer', waitingOn: null };
  }
  if (target.signed_at) {
    return { ok: false, reason: 'already_signed', waitingOn: null };
  }

  const waitingOn =
    ordered.find(
      (signer) =>
        signer.signing_order < target.signing_order && !signer.signed_at,
    ) ?? null;

  if (waitingOn) {
    return { ok: false, reason: 'waiting_on_earlier_party', waitingOn };
  }

  return { ok: true, reason: null, waitingOn: null };
}

export function isContractSigningExpired(
  signingExpiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!signingExpiresAt) return false;
  return new Date(signingExpiresAt).getTime() <= now.getTime();
}

export function computeContractSigningExpiry(
  from: Date = new Date(),
  ttlDays: number,
): string {
  const expires = new Date(from.getTime());
  expires.setUTCDate(expires.getUTCDate() + Math.max(1, Math.round(ttlDays)));
  return expires.toISOString();
}

export function signerTurnErrorMessage(result: SignerTurnResult): string {
  switch (result.reason) {
    case 'already_signed':
      return 'This party has already signed.';
    case 'waiting_on_earlier_party': {
      const name = result.waitingOn?.name?.trim() || 'the previous party';
      return `Waiting for ${name} to sign first.`;
    }
    case 'unknown_signer':
      return 'This signer is not part of the agreement.';
    case 'signing_expired':
      return 'The signing deadline for this agreement has passed.';
    default:
      return 'This party cannot sign yet.';
  }
}
