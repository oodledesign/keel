import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import {
  ACCOUNT_DELETION_GRACE_DAYS,
  AccountDeletionBlockedError,
  type AccountDeletionBlocker,
  type AccountDeletionSource,
  type OwnedTeamWorkspace,
  collectAccountDeletionBlockers,
} from './account-deletion.shared';

export * from './account-deletion.shared';

/** Paid Ozer plans (`account_billing`) and Stripe subscriptions that still charge. */
const CHARGING_BILLING_STATUSES = [
  'active',
  'past_due_grace',
  'past_due_restricted',
];
const CHARGING_SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
];

export type AccountDeletionEligibility = {
  blockers: AccountDeletionBlocker[];
  ownedTeamWorkspaces: OwnedTeamWorkspace[];
  scheduledFor: string | null;
};

export function createAccountDeletionService(adminClient: SupabaseClient) {
  return new AccountDeletionService(adminClient);
}

/**
 * Deleting an account never deletes the user row. It schedules the deletion,
 * locks sign-in, and a nightly job wipes the data after the grace period
 * (`public.complete_account_deletion`).
 */
class AccountDeletionService {
  private namespace = 'accounts.deletion';

  constructor(private readonly admin: SupabaseClient) {}

  async getEligibility(params: {
    userId: string;
    recentlyAuthenticated: boolean;
  }): Promise<AccountDeletionEligibility> {
    const [isProtected, scheduledFor, ownedTeamWorkspaces] = await Promise.all([
      this.isProtected(params.userId),
      this.loadScheduledFor(params.userId),
      this.loadOwnedTeamWorkspaces(params.userId),
    ]);

    const hasChargingSubscription = await this.hasChargingSubscription([
      params.userId,
      ...ownedTeamWorkspaces.map((workspace) => workspace.id),
    ]);

    return {
      blockers: collectAccountDeletionBlockers({
        isProtected,
        isScheduled: scheduledFor !== null,
        hasChargingSubscription,
        ownedTeamWorkspaces,
        recentlyAuthenticated: params.recentlyAuthenticated,
      }),
      ownedTeamWorkspaces,
      scheduledFor,
    };
  }

  async schedule(params: {
    userId: string;
    email: string | null;
    source: AccountDeletionSource;
    requestedBy: string;
    recentlyAuthenticated: boolean;
  }): Promise<{ scheduledFor: string }> {
    const logger = await getLogger();
    const ctx = {
      name: this.namespace,
      userId: params.userId,
      source: params.source,
      requestedBy: params.requestedBy,
    };

    const { blockers } = await this.getEligibility(params);

    if (blockers.length > 0) {
      logger.warn({ ...ctx, blockers }, 'Account deletion blocked');
      throw new AccountDeletionBlockedError(blockers);
    }

    const { data, error } = await this.admin
      .rpc('schedule_account_deletion', {
        target_user_id: params.userId,
        target_source: params.source,
        target_requested_by: params.requestedBy,
        target_contact_email: params.email,
        grace_period: `${ACCOUNT_DELETION_GRACE_DAYS} days`,
      })
      .single<{ scheduled_for: string }>();

    if (error || !data) {
      logger.error({ ...ctx, error }, 'Could not schedule account deletion');
      throw new Error('Could not schedule account deletion');
    }

    logger.info(
      { ...ctx, scheduledFor: data.scheduled_for },
      'Account deletion scheduled',
    );

    if (params.email) {
      await this.sendScheduledEmail(params.email, data.scheduled_for, ctx);
    }

    return { scheduledFor: data.scheduled_for };
  }

  private async isProtected(userId: string) {
    const { data, error } = await this.admin.rpc('is_user_deletion_protected', {
      target_user_id: userId,
    });

    if (error) {
      throw new Error('Could not check account protection');
    }

    return data === true;
  }

  private async loadScheduledFor(userId: string) {
    const { data, error } = await this.admin
      .from('account_deletions')
      .select('scheduled_for')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'failed'])
      .maybeSingle<{ scheduled_for: string }>();

    if (error) {
      throw new Error('Could not load scheduled deletion');
    }

    return data?.scheduled_for ?? null;
  }

  private async loadOwnedTeamWorkspaces(
    userId: string,
  ): Promise<OwnedTeamWorkspace[]> {
    const { data: accounts, error } = await this.admin
      .from('accounts')
      .select('id, name')
      .eq('primary_owner_user_id', userId)
      .eq('is_personal_account', false)
      .order('name');

    if (error) {
      throw new Error('Could not load owned workspaces');
    }

    if (!accounts?.length) {
      return [];
    }

    const { data: memberships, error: membershipsError } = await this.admin
      .from('accounts_memberships')
      .select('account_id, user_id')
      .in(
        'account_id',
        accounts.map((account) => account.id),
      )
      .neq('user_id', userId);

    if (membershipsError) {
      throw new Error('Could not load workspace members');
    }

    return accounts.map((account) => ({
      id: account.id as string,
      name: (account.name as string | null)?.trim() || 'Untitled workspace',
      otherMemberCount: (memberships ?? []).filter(
        (row) => row.account_id === account.id,
      ).length,
    }));
  }

  private async hasChargingSubscription(accountIds: string[]) {
    const [billing, subscriptions] = await Promise.all([
      this.admin
        .from('account_billing')
        .select('account_id', { count: 'exact', head: true })
        .in('account_id', accountIds)
        .in('subscription_status', CHARGING_BILLING_STATUSES),
      this.admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('account_id', accountIds)
        .in('status', CHARGING_SUBSCRIPTION_STATUSES),
    ]);

    if (billing.error || subscriptions.error) {
      throw new Error('Could not check subscriptions');
    }

    return (billing.count ?? 0) + (subscriptions.count ?? 0) > 0;
  }

  private async sendScheduledEmail(
    email: string,
    scheduledFor: string,
    ctx: Record<string, unknown>,
  ) {
    const logger = await getLogger();

    try {
      const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim();
      const fromEmail = process.env.EMAIL_SENDER?.trim();

      if (!productName || !fromEmail) {
        throw new Error(
          'NEXT_PUBLIC_PRODUCT_NAME and EMAIL_SENDER are required',
        );
      }

      const { renderAccountDeleteEmail } = await import('@kit/email-templates');
      const { getMailer } = await import('@kit/mailers');
      const { insertPlatformEmailLog } =
        await import('@kit/supabase/platform-email-log');

      const purgeDate = new Date(scheduledFor).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const { html, subject } = await renderAccountDeleteEmail({
        productName,
        purgeDate,
      });

      let status: 'sent' | 'failed' = 'sent';
      let errorMessage: string | null = null;

      try {
        const mailer = await getMailer();
        await mailer.sendEmail({ from: fromEmail, to: email, subject, html });
      } catch (error) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        await insertPlatformEmailLog({
          emailType: 'account_deletion',
          recipientEmail: email,
          senderEmail: fromEmail,
          subject,
          status,
          errorMessage,
          htmlBody: html,
          metadata: { kind: 'account_deletion_scheduled', scheduledFor },
        });
      }
    } catch (error) {
      logger.error(
        { ...ctx, error },
        'Failed to send deletion scheduled email',
      );
    }
  }
}
