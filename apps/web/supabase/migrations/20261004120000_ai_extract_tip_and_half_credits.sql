-- 1) Stamp which message tip was last auto-extracted (even when empty).
-- 2) Allow half-credit metering (Gemini Flash extract/triage at 0.5).

alter table public.email_threads
  add column if not exists assistant_extract_message_id uuid
    references public.email_messages (id) on delete set null;

comment on column public.email_threads.assistant_extract_message_id is
  'Latest email_messages.id for which auto task_extract was attempted (including empty results).';

create index if not exists idx_email_threads_assistant_extract_message
  on public.email_threads (assistant_extract_message_id)
  where assistant_extract_message_id is not null;

-- Half-credit support: plan pool, purchases, and ledger use numeric(12,1).
alter table public.ai_credit_balances
  alter column credits_remaining type numeric(12, 1)
    using credits_remaining::numeric(12, 1);

alter table public.ai_credit_balances
  alter column credits_monthly_limit type numeric(12, 1)
    using credits_monthly_limit::numeric(12, 1);

alter table public.ai_credit_balances
  alter column credits_purchased type numeric(12, 1)
    using credits_purchased::numeric(12, 1);

alter table public.ai_credit_transactions
  alter column credits_used type numeric(12, 1)
    using credits_used::numeric(12, 1);

alter table public.ai_credit_balances
  drop constraint if exists ai_credit_balances_credits_purchased_nonneg;

alter table public.ai_credit_balances
  add constraint ai_credit_balances_credits_purchased_nonneg
  check (credits_purchased >= 0);

alter table public.ai_credit_balances
  drop constraint if exists ai_credit_balances_credits_remaining_nonneg;

alter table public.ai_credit_balances
  add constraint ai_credit_balances_credits_remaining_nonneg
  check (credits_remaining >= 0);

alter table public.ai_credit_balances
  drop constraint if exists ai_credit_balances_credits_monthly_limit_nonneg;

alter table public.ai_credit_balances
  add constraint ai_credit_balances_credits_monthly_limit_nonneg
  check (credits_monthly_limit >= 0);

alter table public.ai_credit_transactions
  drop constraint if exists ai_credit_transactions_credits_used_nonneg;

alter table public.ai_credit_transactions
  add constraint ai_credit_transactions_credits_used_nonneg
  check (credits_used >= 0);
