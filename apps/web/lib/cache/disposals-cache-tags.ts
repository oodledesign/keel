/**
 * Cross-request cache tags for Disposals / commercial workspace data.
 * Used with `unstable_cache` + `revalidateTag` until Cache Components is enabled.
 */

export function accountBranchesTag(accountId: string) {
  return `account-branches:${accountId}`;
}

export function matchRequirementsTag(accountId: string) {
  return `match-reqs:${accountId}`;
}

/** Broad invalidation for any disposals list/detail under an account. */
export function disposalsAccountTag(accountId: string) {
  return `disposals-account:${accountId}`;
}

export function disposalsListTag(accountId: string, userId: string) {
  return `disposals-list:${accountId}:${userId}`;
}

export function disposalsDetailTag(listingId: string, userId: string) {
  return `disposals-detail:${listingId}:${userId}`;
}
