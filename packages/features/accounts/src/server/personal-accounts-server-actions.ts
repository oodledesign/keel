'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { enhanceAction } from '@kit/next/actions';
import { createOtpApi } from '@kit/otp';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DeletePersonalAccountSchema } from '../schema/delete-personal-account.schema';
import { createAccountDeletionService } from './services/account-deletion.service';

const enableAccountDeletion =
  process.env.NEXT_PUBLIC_ENABLE_PERSONAL_ACCOUNT_DELETION === 'true';

export async function refreshAuthSession() {
  const client = getSupabaseServerClient();

  await client.auth.refreshSession();

  return {};
}

/**
 * Blockers shown before the OTP step. The emailed code is the web's recent
 * sign-in check, so it is not reported here.
 */
export const loadAccountDeletionEligibilityAction = enhanceAction(
  async (_: void, user) => {
    const eligibility = await createAccountDeletionService(
      getSupabaseServerAdminClient(),
    ).getEligibility({ userId: user.id, recentlyAuthenticated: true });

    return { enabled: enableAccountDeletion, ...eligibility };
  },
  {},
);

export const deletePersonalAccountAction = enhanceAction(
  async (formData: FormData, user) => {
    const logger = await getLogger();

    const { success } = DeletePersonalAccountSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );

    if (!success) {
      throw new Error('Invalid form data');
    }

    const ctx = {
      name: 'account.delete',
      userId: user.id,
    };

    const otp = formData.get('otp') as string;

    if (!otp) {
      throw new Error('OTP is required');
    }

    if (!enableAccountDeletion) {
      logger.warn(ctx, `Account deletion is not enabled`);

      throw new Error('Account deletion is not enabled');
    }

    const client = getSupabaseServerClient();
    const otpResult = await createOtpApi(client).verifyToken({
      token: otp,
      userId: user.id,
      purpose: 'delete-personal-account',
    });

    if (!otpResult.valid) {
      throw new Error('Invalid OTP');
    }

    if (otpResult.user_id !== user.id) {
      logger.error(
        ctx,
        `This token was meant to be used by a different user. Exiting.`,
      );

      throw new Error('Nonce mismatch');
    }

    await createAccountDeletionService(getSupabaseServerAdminClient()).schedule(
      {
        userId: user.id,
        email: user.email ?? null,
        source: 'web',
        requestedBy: user.id,
        recentlyAuthenticated: true,
      },
    );

    await client.auth.signOut();

    revalidatePath('/', 'layout');

    redirect('/');
  },
  {},
);
