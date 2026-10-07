import {
  ACCOUNT_DELETION_GRACE_DAYS,
  type AccountDeletionBlocker,
  type OwnedTeamWorkspace,
} from '@kit/accounts/account-deletion-shared';

import { NativeHttpError } from './http';

export {
  isRecentSignIn,
  lastSignInFromAmr,
} from '@kit/accounts/account-deletion-shared';

export const NATIVE_ACCOUNT_DELETE_CONFIRMATION = 'DELETE';

export function parseNativeAccountDeleteConfirmation(body: unknown) {
  const confirm =
    body && typeof body === 'object' && 'confirm' in body
      ? (body as { confirm: unknown }).confirm
      : undefined;

  if (
    typeof confirm !== 'string' ||
    confirm.trim().toUpperCase() !== NATIVE_ACCOUNT_DELETE_CONFIRMATION
  ) {
    throw new NativeHttpError(
      400,
      `Type ${NATIVE_ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`,
    );
  }
}

function formatLongDate(iso: string | null) {
  if (!iso) return 'soon';

  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function nativeAccountDeletionBlockerMessage(
  blocker: AccountDeletionBlocker,
  context: {
    scheduledFor: string | null;
    ownedTeamWorkspaces: OwnedTeamWorkspace[];
  },
) {
  switch (blocker) {
    case 'protected':
      return 'This account is protected and can’t be deleted. Email privacy@ozer.so if you need help.';
    case 'already_scheduled':
      return `Your account is already scheduled for deletion on ${formatLongDate(context.scheduledFor)}.`;
    case 'active_subscription':
      return 'You have an active paid subscription. Cancel it in Billing on the web first.';
    case 'owns_shared_workspace': {
      const names = context.ownedTeamWorkspaces
        .filter((workspace) => workspace.otherMemberCount > 0)
        .map((workspace) => workspace.name)
        .join(', ');
      return `You own workspaces other people use (${names}). Transfer ownership on the web first.`;
    }
    case 'recent_sign_in_required':
      return 'For your security, sign in again before deleting your account.';
  }
}

export function toNativeAccountDeletionPreview(input: {
  enabled: boolean;
  blockers: AccountDeletionBlocker[];
  scheduledFor: string | null;
  ownedTeamWorkspaces: OwnedTeamWorkspace[];
}) {
  return {
    deletion_enabled: input.enabled,
    grace_days: ACCOUNT_DELETION_GRACE_DAYS,
    scheduled_for: input.scheduledFor,
    blockers: input.blockers.map((code) => ({
      code,
      message: nativeAccountDeletionBlockerMessage(code, input),
    })),
    owned_team_workspaces: input.ownedTeamWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      other_member_count: workspace.otherMemberCount,
    })),
  };
}
