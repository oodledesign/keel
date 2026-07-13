export const ACCOUNT_BILLING_STATUSES = [
  'trialing',
  'active',
  'past_due_grace',
  'past_due_restricted',
  'suspended',
  'trial_expired',
  'canceled',
] as const;

export type AccountBillingStatus = (typeof ACCOUNT_BILLING_STATUSES)[number];

export const BILLING_EMAIL_KINDS = [
  'trial_day_7',
  'trial_ending_3d',
  'trial_ending_1d',
  'trial_ended',
  'payment_failed',
  'payment_reminder_3d',
  /** Alias kept for notification_log compatibility; cron sends account_restricted at day 7. */
  'payment_reminder_7d',
  'account_restricted',
  'account_suspended',
  'cancel_warning',
  'payment_recovered',
  'subscription_canceled',
] as const;

export type BillingEmailKind = (typeof BILLING_EMAIL_KINDS)[number];

/** Days of full access after first payment failure before restricted mode. */
export const BILLING_GRACE_PERIOD_DAYS = 7;

/** Days from first past_due before suspension (grace + restricted). */
export const BILLING_SUSPEND_AFTER_DAYS = 14;

/** Days suspended before moving to canceled (data retained; no delete). */
export const BILLING_CANCEL_AFTER_SUSPEND_DAYS = 30;

export type AccountBillingRow = {
  account_id: string;
  subscription_status: AccountBillingStatus | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  grace_period_ends_at: string | null;
  restricted_at: string | null;
  suspended_at: string | null;
  canceled_at: string | null;
  updated_at?: string | null;
};
