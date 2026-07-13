-- Extend billing notification + outbox kinds for Prompt 3 lifecycle emails.

alter table public.billing_notification_log
  drop constraint if exists billing_notification_log_notification_type_check;

alter table public.billing_notification_log
  add constraint billing_notification_log_notification_type_check
  check (
    notification_type in (
      'trial_day_7',
      'trial_ending_3d',
      'trial_ending_1d',
      'trial_ended',
      'payment_failed',
      'payment_reminder_3d',
      'payment_reminder_7d',
      'account_restricted',
      'account_suspended',
      'cancel_warning',
      'payment_recovered',
      'subscription_canceled'
    )
  );

alter table public.billing_email_outbox
  drop constraint if exists billing_email_outbox_email_kind_check;

alter table public.billing_email_outbox
  add constraint billing_email_outbox_email_kind_check
  check (
    email_kind in (
      'trial_day_7',
      'trial_ending_3d',
      'trial_ending_1d',
      'trial_ended',
      'payment_failed',
      'payment_reminder_3d',
      'payment_reminder_7d',
      'account_restricted',
      'account_suspended',
      'cancel_warning',
      'payment_recovered',
      'subscription_canceled'
    )
  );
