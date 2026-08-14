-- Pending billable seat decreases (scheduled for period end).
alter table public.account_plan_limits
  add column if not exists pending_billable_seats integer,
  add column if not exists pending_seats_effective_at timestamptz;

comment on column public.account_plan_limits.pending_billable_seats is
  'Billable seat quantity scheduled to apply at pending_seats_effective_at (period-end downgrade).';

comment on column public.account_plan_limits.pending_seats_effective_at is
  'When pending_billable_seats takes effect (usually current Stripe period end).';
