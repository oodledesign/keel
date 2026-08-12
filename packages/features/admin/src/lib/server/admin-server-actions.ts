'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  BanUserSchema,
  DeleteAccountSchema,
  DeleteUserSchema,
  ImpersonateUserSchema,
  ReactivateUserSchema,
} from './schema/admin-actions.schema';
import { CreateUserSchema } from './schema/create-user.schema';
import { ResetPasswordSchema } from './schema/reset-password.schema';
import { createAdminAccountsService } from './services/admin-accounts.service';
import { createAdminAuthUserService } from './services/admin-auth-user.service';
import { adminAction } from './utils/admin-action';
import {
  consumeImpersonationRestoreSession,
  createImpersonationRestoreSession,
  readImpersonationSessionIdFromCookie,
} from './utils/impersonation-session';

/**
 * @name banUserAction
 * @description Ban a user from the system.
 */
export const banUserAction = adminAction(
  enhanceAction(
    async ({ userId }) => {
      const service = getAdminAuthService();
      const logger = await getLogger();

      logger.info({ userId }, `Super Admin is banning user...`);

      const { error } = await service.banUser(userId);

      if (error) {
        logger.error({ error }, `Error banning user`);

        return {
          success: false,
        };
      }

      revalidateAdmin();

      logger.info({ userId }, `Super Admin has successfully banned user`);
    },
    {
      schema: BanUserSchema,
    },
  ),
);

/**
 * @name reactivateUserAction
 * @description Reactivate a user in the system.
 */
export const reactivateUserAction = adminAction(
  enhanceAction(
    async ({ userId }) => {
      const service = getAdminAuthService();
      const logger = await getLogger();

      logger.info({ userId }, `Super Admin is reactivating user...`);

      const { error } = await service.reactivateUser(userId);

      if (error) {
        logger.error({ error }, `Error reactivating user`);

        return {
          success: false,
        };
      }

      revalidateAdmin();

      logger.info({ userId }, `Super Admin has successfully reactivated user`);
    },
    {
      schema: ReactivateUserSchema,
    },
  ),
);

/**
 * @name impersonateUserAction
 * @description Impersonate a user in the system.
 */
export const impersonateUserAction = adminAction(
  enhanceAction(
    async ({ userId, reason, supportTicketId }, adminUser) => {
      const client = getSupabaseServerClient();
      const adminClient = getSupabaseServerAdminClient();
      const service = createAdminAuthUserService(client, adminClient);
      const logger = await getLogger();

      logger.info(
        { userId, reason, supportTicketId },
        `Super Admin is impersonating user...`,
      );

      const {
        data: { session: adminSession },
      } = await client.auth.getSession();

      if (!adminSession?.access_token || !adminSession.refresh_token) {
        throw new Error('Admin session missing; cannot start impersonation');
      }

      const targetTokens = await service.impersonateUser(userId);

      const { sessionId, expiresAt } = await createImpersonationRestoreSession({
        adminClient,
        actorUserId: adminUser.id,
        targetUserId: userId,
        adminTokens: {
          accessToken: adminSession.access_token,
          refreshToken: adminSession.refresh_token,
        },
        reason,
        supportTicketId,
      });

      const { error: auditError } = await adminClient
        .from('admin_action_log')
        .insert({
          actor_user_id: adminUser.id,
          action: 'impersonate_user_start',
          target_account_id: null,
          metadata: {
            targetUserId: userId,
            reason,
            supportTicketId: supportTicketId ?? null,
            impersonationSessionId: sessionId,
            expiresAt,
          },
        });

      if (auditError) {
        logger.error(
          { error: auditError, userId },
          'Failed to audit impersonation start',
        );
      }

      logger.info(
        { userId, impersonationSessionId: sessionId },
        `Super Admin has started impersonating user`,
      );

      return targetTokens;
    },
    {
      schema: ImpersonateUserSchema,
    },
  ),
);

/**
 * @name endImpersonationAction
 * @description Restore the stashed super-admin session after impersonation.
 * Not wrapped in adminAction — the current JWT is the target user.
 */
export const endImpersonationAction = enhanceAction(
  async (_data, user) => {
    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();
    const sessionId = await readImpersonationSessionIdFromCookie();

    if (!sessionId) {
      throw new Error('No active impersonation session');
    }

    const restored = await consumeImpersonationRestoreSession({
      adminClient,
      sessionId,
      targetUserId: user.id,
    });

    if (!restored) {
      throw new Error('Impersonation session is invalid or expired');
    }

    const { error: auditError } = await adminClient
      .from('admin_action_log')
      .insert({
        actor_user_id: restored.actorUserId,
        action: 'impersonate_user_end',
        target_account_id: null,
        metadata: {
          targetUserId: user.id,
          reason: restored.reason,
          supportTicketId: restored.supportTicketId,
          impersonationSessionId: sessionId,
        },
      });

    if (auditError) {
      logger.error(
        { error: auditError, sessionId },
        'Failed to audit impersonation end',
      );
    }

    logger.info(
      {
        actorUserId: restored.actorUserId,
        targetUserId: user.id,
        impersonationSessionId: sessionId,
      },
      'Super Admin ended impersonation',
    );

    return {
      accessToken: restored.tokens.accessToken,
      refreshToken: restored.tokens.refreshToken,
    };
  },
  {
    auth: true,
    schema: z.object({}),
  },
);

/**
 * @name deleteUserAction
 * @description Delete a user from the system.
 */
export const deleteUserAction = adminAction(
  enhanceAction(
    async ({ userId }) => {
      const service = getAdminAuthService();
      const logger = await getLogger();

      logger.info({ userId }, `Super Admin is deleting user...`);

      await service.deleteUser(userId);

      logger.info({ userId }, `Super Admin has successfully deleted user`);

      return redirect('/admin/accounts');
    },
    {
      schema: DeleteUserSchema,
    },
  ),
);

/**
 * @name deleteAccountAction
 * @description Delete an account from the system.
 */
export const deleteAccountAction = adminAction(
  enhanceAction(
    async ({ accountId }) => {
      const service = getAdminAccountsService();
      const logger = await getLogger();

      logger.info({ accountId }, `Super Admin is deleting account...`);

      await service.deleteAccount(accountId);

      revalidateAdmin();

      logger.info(
        { accountId },
        `Super Admin has successfully deleted account`,
      );

      return redirect('/admin/accounts');
    },
    {
      schema: DeleteAccountSchema,
    },
  ),
);

/**
 * @name createUserAction
 * @description Create a new user in the system.
 */
export const createUserAction = adminAction(
  enhanceAction(
    async ({ email, password, emailConfirm }) => {
      const adminClient = getSupabaseServerAdminClient();
      const logger = await getLogger();

      logger.info({ email }, `Super Admin is creating a new user...`);

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: emailConfirm,
      });

      if (error) {
        logger.error({ error }, `Error creating user`);
        throw new Error(`Error creating user: ${error.message}`);
      }

      logger.info(
        { userId: data.user.id },
        `Super Admin has successfully created a new user`,
      );

      revalidatePath(`/admin/accounts`);

      return {
        success: true,
        user: data.user,
      };
    },
    {
      schema: CreateUserSchema,
    },
  ),
);

/**
 * @name resetPasswordAction
 * @description Reset a user's password by sending a password reset email.
 */
export const resetPasswordAction = adminAction(
  enhanceAction(
    async ({ userId }) => {
      const service = getAdminAuthService();
      const logger = await getLogger();

      logger.info({ userId }, `Super Admin is resetting user password...`);

      const result = await service.resetPassword(userId);

      logger.info(
        { userId },
        `Super Admin has successfully sent password reset email`,
      );

      return result;
    },
    {
      schema: ResetPasswordSchema,
    },
  ),
);

function revalidateAdmin() {
  revalidatePath(`/admin/accounts/[id]`, 'page');
}

function getAdminAuthService() {
  const client = getSupabaseServerClient();
  const adminClient = getSupabaseServerAdminClient();

  return createAdminAuthUserService(client, adminClient);
}

function getAdminAccountsService() {
  const adminClient = getSupabaseServerAdminClient();

  return createAdminAccountsService(adminClient);
}
