-- AI credit threshold alert state (once per threshold per billing period).

alter table public.ai_credit_balances
  add column if not exists credit_alert_period_start timestamptz;

alter table public.ai_credit_balances
  add column if not exists credit_alerts_sent smallint not null default 0;

comment on column public.ai_credit_balances.credit_alert_period_start is
  'Billing period_start the credit_alerts_sent bitmask applies to.';

comment on column public.ai_credit_balances.credit_alerts_sent is
  'Bitmask of AI credit threshold emails sent this period: bit0=50%, bit1=25%, bit2=10%, bit3=0%.';

-- Clear alert state whenever the monthly pool rolls over.
create or replace function public.reset_ai_credits_if_expired(p_account_id uuid)
returns public.ai_credit_balances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_credit_balances;
begin
  select *
  into v_row
  from public.ai_credit_balances
  where account_id = p_account_id
  for update;

  if not found then
    return null;
  end if;

  if now() > v_row.period_end then
    update public.ai_credit_balances
    set
      credits_remaining = credits_monthly_limit,
      period_start = period_start + interval '1 month',
      period_end = period_end + interval '1 month',
      credit_alerts_sent = 0,
      credit_alert_period_start = period_start + interval '1 month',
      updated_at = now()
    where account_id = p_account_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.reset_ai_credits_if_expired(uuid) from public;
grant execute on function public.reset_ai_credits_if_expired(uuid) to service_role;
