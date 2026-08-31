-- Populate Free / Pro usage-cap values on account_plan_limits.
-- Display names Free/Pro are app-config only; product/plan ids unchanged.
-- client_request_credit_allowance NULL = zero / not available (not unlimited).

comment on column public.account_plan_limits.client_request_credit_allowance is
  'Monthly client-request credit allotment; NULL = zero / feature not available (unlike other max_* columns where NULL = unlimited).';

-- Free (business-lite-free / plan_family business_lite)
-- Existing members are never removed; max_members=2 only blocks new invites
-- once usage is already at or above the cap (grandfathering).
update public.account_plan_limits
set
  max_members = 2,
  max_active_clients = 3,
  max_invoices_per_month = 5,
  max_open_tasks = 20,
  max_bookings_per_month = 5,
  max_portal_storage_bytes = 262144000, -- 250 MiB = 250 * 1024 * 1024
  client_request_credit_allowance = null,
  meeting_coaching_enabled = false,
  updated_at = now()
where plan_family = 'business_lite'
   or plan_id = 'business-lite-free';

-- Pro (business-monthly / business-yearly / plan_family business)
-- max_members left unchanged (still derived from Stripe seat quantity).
update public.account_plan_limits
set
  max_active_clients = null,
  max_invoices_per_month = null,
  max_open_tasks = null,
  max_bookings_per_month = null,
  max_portal_storage_bytes = 26843545600, -- 25 GiB = 25 * 1024^3
  client_request_credit_allowance = null,
  meeting_coaching_enabled = true,
  updated_at = now()
where plan_family = 'business'
   or plan_id in ('business-monthly', 'business-yearly');
