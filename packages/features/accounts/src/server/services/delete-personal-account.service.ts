import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getLogger } from '@kit/shared/logger';
import { Database } from '@kit/supabase/database';

type PrepareAccountStoragePurgeClient = {
  rpc: (
    fn: 'prepare_account_storage_purge',
    args: {
      target_account_id: string;
      target_email: string | null;
      target_name: string | null;
    },
  ) => PromiseLike<{ error: { message: string } | null }>;
};

function prepareAccountStoragePurgeClient(
  admin: SupabaseClient<Database>,
): PrepareAccountStoragePurgeClient {
  return admin as unknown as PrepareAccountStoragePurgeClient;
}

export function createDeletePersonalAccountService() {
  return new DeletePersonalAccountService();
}

/**
 * @name DeletePersonalAccountService
 * @description Service for managing accounts in the application
 * @param Database - The Supabase database type to use
 * @example
 * const client = getSupabaseClient();
 * const accountsService = new DeletePersonalAccountService();
 */
class DeletePersonalAccountService {
  private namespace = 'accounts.delete';

  /**
   * @name deletePersonalAccount
   * Delete personal account of a user.
   * This will delete the user from the authentication provider and cancel all subscriptions.
   *
   * Permissions are not checked here, as they are checked in the server action.
   * USE WITH CAUTION. THE USER MUST HAVE THE NECESSARY PERMISSIONS.
   */
  async deletePersonalAccount(params: {
    adminClient: SupabaseClient<Database>;
    account: {
      id: string;
      email: string | null;
    };
  }) {
    const logger = await getLogger();

    const userId = params.account.id;
    const ctx = { userId, name: this.namespace };

    logger.info(
      ctx,
      'User requested to delete their personal account. Processing...',
    );

    // Snapshot owner email before deleteUser — auth.users is gone when the
    // accounts trigger runs, and we still need 14-day / 3-day file-wipe emails.
    try {
      const { error: snapshotError } = await prepareAccountStoragePurgeClient(
        params.adminClient,
      ).rpc('prepare_account_storage_purge', {
        target_account_id: userId,
        target_email: params.account.email,
        target_name: null,
      });

      if (snapshotError) {
        logger.warn(
          { ...ctx, error: snapshotError },
          'Could not snapshot storage-purge notice email before account delete',
        );
      }
    } catch (error) {
      logger.warn(
        { ...ctx, error },
        'Could not snapshot storage-purge notice email before account delete',
      );
    }

    // execute the deletion of the user
    try {
      const response = await params.adminClient.auth.admin.deleteUser(userId);

      if (response.error) {
        throw response.error;
      }

      logger.info(ctx, 'User successfully deleted!');

      if (params.account.email) {
        // dispatch the delete account email. Errors are handled in the method.
        await this.dispatchDeleteAccountEmail({
          email: params.account.email,
          id: params.account.id,
        });
      }

      return {
        success: true,
      };
    } catch (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        'Encountered an error deleting user',
      );

      throw new Error('Error deleting user');
    }
  }

  private async dispatchDeleteAccountEmail(account: {
    email: string;
    id: string;
  }) {
    const logger = await getLogger();
    const ctx = { name: this.namespace, userId: account.id };

    try {
      logger.info(ctx, 'Sending delete account email...');

      await this.sendDeleteAccountEmail(account);

      logger.info(ctx, 'Delete account email sent successfully');
    } catch (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        'Failed to send delete account email',
      );
    }
  }

  private async sendDeleteAccountEmail(account: { email: string }) {
    const emailSettings = this.getEmailSettings();

    const { renderAccountDeleteEmail } = await import('@kit/email-templates');
    const { getMailer } = await import('@kit/mailers');
    const { insertPlatformEmailLog } = await import(
      '@kit/supabase/platform-email-log'
    );

    const mailer = await getMailer();
    const purgeDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const { html, subject } = await renderAccountDeleteEmail({
      productName: emailSettings.productName,
      purgeDate,
    });

    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | null = null;

    try {
      await mailer.sendEmail({
        from: emailSettings.fromEmail,
        html,
        subject,
        to: account.email,
      });
    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await insertPlatformEmailLog({
        emailType: 'account_deletion',
        recipientEmail: account.email,
        senderEmail: emailSettings.fromEmail,
        subject,
        status,
        errorMessage,
        htmlBody: html,
        metadata: { kind: 'account_deletion' },
      });
    }
  }

  private getEmailSettings() {
    const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME;
    const fromEmail = process.env.EMAIL_SENDER;

    return z
      .object({
        productName: z
          .string({
            required_error: 'NEXT_PUBLIC_PRODUCT_NAME is required',
          })
          .min(1),
        fromEmail: z
          .string({
            required_error: 'EMAIL_SENDER is required',
          })
          .min(1),
      })
      .parse({
        productName,
        fromEmail,
      });
  }
}
