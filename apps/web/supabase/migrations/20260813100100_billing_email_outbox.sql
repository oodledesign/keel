-- Durable outbox for billing lifecycle emails (Prompt 2/3).
-- Webhook handlers enqueue here; a worker/after() flush sends via ZeptoMail.

create table if not exists public.billing_email_outbox (
  id uuid primary key default gen_random_uuid (),
  account_id uuid not null references public.accounts (id) on delete cascade,
  email_kind text not null
    check (
      email_kind in (
        'trial_ending_3d',
        'trial_ended',
        'payment_failed',
        'payment_reminder_3d',
        'payment_reminder_7d',
        'account_restricted',
        'account_suspended',
        'payment_recovered',
        'subscription_canceled'
      )
    ),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  stripe_event_id text,
  error text,
  created_at timestamptz not null default now (),
  processed_at timestamptz
);

comment on table public.billing_email_outbox is
  'Queued billing lifecycle emails. Webhooks enqueue; flush/cron sends. Separate from billing_notification_log dedupe.';

create index if not exists billing_email_outbox_pending_idx
  on public.billing_email_outbox (created_at)
  where status = 'pending';

create index if not exists billing_email_outbox_account_id_idx
  on public.billing_email_outbox (account_id);

create unique index if not exists billing_email_outbox_stripe_event_kind_uidx
  on public.billing_email_outbox (stripe_event_id, email_kind)
  where stripe_event_id is not null;

alter table public.billing_email_outbox enable row level security;

revoke all on public.billing_email_outbox from authenticated, service_role;
grant select, insert, update, delete on public.billing_email_outbox to service_role;

drop policy if exists billing_email_outbox_super_admin on public.billing_email_outbox;
create policy billing_email_outbox_super_admin on public.billing_email_outbox
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());
