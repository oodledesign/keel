export const ACCOUNT_DELETION_GRACE_DAYS = 30;
export const ACCOUNT_DELETION_RECENT_SIGN_IN_MINUTES = 10;

export type AccountDeletionSource = 'ios' | 'web' | 'admin';

export type AccountDeletionBlocker =
  | 'protected'
  | 'already_scheduled'
  | 'active_subscription'
  | 'owns_shared_workspace'
  | 'recent_sign_in_required';

export type OwnedTeamWorkspace = {
  id: string;
  name: string;
  otherMemberCount: number;
};

export class AccountDeletionBlockedError extends Error {
  constructor(readonly blockers: AccountDeletionBlocker[]) {
    super(`Account deletion blocked: ${blockers.join(', ')}`);
    this.name = 'AccountDeletionBlockedError';
  }
}

export function collectAccountDeletionBlockers(input: {
  isProtected: boolean;
  isScheduled: boolean;
  hasChargingSubscription: boolean;
  ownedTeamWorkspaces: OwnedTeamWorkspace[];
  recentlyAuthenticated: boolean;
}): AccountDeletionBlocker[] {
  const blockers: AccountDeletionBlocker[] = [];

  if (input.isProtected) blockers.push('protected');
  if (input.isScheduled) blockers.push('already_scheduled');
  if (input.hasChargingSubscription) blockers.push('active_subscription');
  if (input.ownedTeamWorkspaces.some((w) => w.otherMemberCount > 0)) {
    blockers.push('owns_shared_workspace');
  }
  if (!input.recentlyAuthenticated) blockers.push('recent_sign_in_required');

  return blockers;
}

/**
 * Most recent sign-in time from a Supabase access token's `amr` claim.
 * Token refreshes keep the original timestamps, so this is a real sign-in.
 */
export function lastSignInFromAmr(amr: unknown): Date | null {
  if (!Array.isArray(amr)) return null;

  const timestamps = amr
    .map((entry) =>
      entry && typeof entry === 'object' && 'timestamp' in entry
        ? Number((entry as { timestamp: unknown }).timestamp)
        : NaN,
    )
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!timestamps.length) return null;

  return new Date(Math.max(...timestamps) * 1000);
}

export function isRecentSignIn(signedInAt: Date | null, now = new Date()) {
  if (!signedInAt) return false;

  const ageMs = now.getTime() - signedInAt.getTime();
  return (
    ageMs >= 0 && ageMs <= ACCOUNT_DELETION_RECENT_SIGN_IN_MINUTES * 60_000
  );
}
