-- Allow a 24-hour plan renewal notice once per billing period.

alter table public.billing_notification_log
  add column if not exists period_key text not null default '';

alter table public.billing_notification_log
  drop constraint if exists billing_notification_log_subscription_id_notification_type_key;

drop index if exists billing_notification_log_subscription_id_notification_type_key;
drop index if exists billing_notification_log_dedupe_idx;

alter table public.billing_notification_log
  drop constraint if exists billing_notification_log_dedupe_key;

alter table public.billing_notification_log
  add constraint billing_notification_log_dedupe_key
  unique (subscription_id, notification_type, period_key);

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
      'subscription_canceled',
      'renewal_notice'
    )
  );
