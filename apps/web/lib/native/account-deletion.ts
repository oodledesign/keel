import 'server-only';

import {
  AccountDeletionBlockedError,
  createAccountDeletionService,
} from '@kit/accounts/account-deletion';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import featuresFlagConfig from '~/config/feature-flags.config';

import {
  isRecentSignIn,
  toNativeAccountDeletionPreview,
} from './account-deletion-shared';
import { NativeHttpError } from './http';

type NativeDeletionRequester = {
  userId: string;
  email: string | null;
  signedInAt: Date | null;
};

function service() {
  return createAccountDeletionService(getSupabaseServerAdminClient());
}

export async function loadNativeAccountDeletionPreview(
  requester: NativeDeletionRequester,
) {
  const eligibility = await service().getEligibility({
    userId: requester.userId,
    recentlyAuthenticated: isRecentSignIn(requester.signedInAt),
  });

  return toNativeAccountDeletionPreview({
    enabled: featuresFlagConfig.enableAccountDeletion,
    ...eligibility,
  });
}

export async function scheduleNativeAccountDeletion(
  requester: NativeDeletionRequester,
) {
  if (!featuresFlagConfig.enableAccountDeletion) {
    throw new NativeHttpError(403, 'Account deletion is not enabled');
  }

  try {
    return await service().schedule({
      userId: requester.userId,
      email: requester.email,
      source: 'ios',
      requestedBy: requester.userId,
      recentlyAuthenticated: isRecentSignIn(requester.signedInAt),
    });
  } catch (error) {
    if (error instanceof AccountDeletionBlockedError) {
      const preview = await loadNativeAccountDeletionPreview(requester);
      throw new NativeHttpError(
        409,
        preview.blockers[0]?.message ?? 'Your account can’t be deleted yet.',
      );
    }

    throw error;
  }
}
