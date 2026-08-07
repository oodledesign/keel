BEGIN;
create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

-- Tables from Prompt 1
select has_table('public', 'request_types');
select has_table('public', 'client_credit_pools');
select has_table('public', 'client_credit_batches');
select has_table('public', 'client_credit_transactions');

select tests.rls_enabled('public', 'request_types');
select tests.rls_enabled('public', 'client_credit_pools');
select tests.rls_enabled('public', 'client_credit_batches');
select tests.rls_enabled('public', 'client_credit_transactions');

select has_function('public', 'grant_client_credits');
select has_function('public', 'consume_client_credits');
select has_function('public', 'refund_client_credits');
select has_function('public', 'ensure_client_credit_pool');

-- Ephemeral fixtures (rolled back at end)
DO $$
DECLARE
  v_account_id uuid;
  v_business_id uuid;
  v_org_id uuid;
  v_ticket_id uuid;
  v_grant1 jsonb;
  v_grant2 jsonb;
  v_consume jsonb;
  v_insuf jsonb;
  v_refund jsonb;
  v_balance integer;
  v_batch1 uuid;
  v_batch2 uuid;
  v_remaining1 integer;
  v_remaining2 integer;
BEGIN
  INSERT INTO public.accounts (id, name, slug, is_personal_account)
  VALUES (
    gen_random_uuid(),
    'Credit Ledger Test',
    'credit-ledger-test-' || substr(gen_random_uuid()::text, 1, 8),
    false
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.businesses (id, account_id, name, slug)
  VALUES (
    gen_random_uuid(),
    v_account_id,
    'Credit Biz',
    'credit-biz-' || substr(gen_random_uuid()::text, 1, 8)
  )
  RETURNING id INTO v_business_id;

  INSERT INTO public.client_orgs (id, business_id, name, slug)
  VALUES (
    gen_random_uuid(),
    v_business_id,
    'Credit Org',
    'credit-org-' || substr(gen_random_uuid()::text, 1, 8)
  )
  RETURNING id INTO v_org_id;

  -- Batch A expires sooner
  v_grant1 := public.grant_client_credits(
    v_org_id,
    v_account_id,
    5,
    'retainer_grant',
    now() + interval '7 days',
    NULL
  );
  -- Batch B expires later
  v_grant2 := public.grant_client_credits(
    v_org_id,
    v_account_id,
    10,
    'topup_purchase',
    now() + interval '30 days',
    NULL
  );

  IF NOT (v_grant1->>'ok')::boolean OR NOT (v_grant2->>'ok')::boolean THEN
    RAISE EXCEPTION 'grants failed: % / %', v_grant1, v_grant2;
  END IF;

  v_batch1 := (v_grant1->>'batch_id')::uuid;
  v_batch2 := (v_grant2->>'batch_id')::uuid;

  SELECT balance INTO v_balance
  FROM public.client_credit_pools
  WHERE client_org_id = v_org_id;

  IF v_balance <> 15 THEN
    RAISE EXCEPTION 'expected pool balance 15, got %', v_balance;
  END IF;

  -- Exact consume of all 15
  INSERT INTO public.support_tickets (id, account_id, client_org_id, title, status)
  VALUES (gen_random_uuid(), v_account_id, v_org_id, 'Exact consume', 'open')
  RETURNING id INTO v_ticket_id;

  v_consume := public.consume_client_credits(v_org_id, 15, v_ticket_id, NULL);
  IF NOT (v_consume->>'ok')::boolean THEN
    RAISE EXCEPTION 'exact consume failed: %', v_consume;
  END IF;
  IF (v_consume->>'consumed')::integer <> 15 THEN
    RAISE EXCEPTION 'expected consumed 15, got %', v_consume;
  END IF;

  SELECT balance INTO v_balance
  FROM public.client_credit_pools
  WHERE client_org_id = v_org_id;
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'expected balance 0 after exact consume, got %', v_balance;
  END IF;

  -- FIFO: first allocation should be batch1 (earlier expiry)
  IF (v_consume->'allocations'->0->>'batch_id')::uuid IS DISTINCT FROM v_batch1 THEN
    RAISE EXCEPTION 'FIFO broken: first allocation was %, expected %',
      v_consume->'allocations'->0->>'batch_id', v_batch1;
  END IF;

  -- Refund restores batches
  v_refund := public.refund_client_credits(v_ticket_id, NULL, 'test_refund');
  IF NOT (v_refund->>'ok')::boolean OR (v_refund->>'refunded')::integer <> 15 THEN
    RAISE EXCEPTION 'refund failed: %', v_refund;
  END IF;

  SELECT units_remaining INTO v_remaining1
  FROM public.client_credit_batches WHERE id = v_batch1;
  SELECT units_remaining INTO v_remaining2
  FROM public.client_credit_batches WHERE id = v_batch2;

  IF v_remaining1 <> 5 OR v_remaining2 <> 10 THEN
    RAISE EXCEPTION 'refund did not restore batches: % / %', v_remaining1, v_remaining2;
  END IF;

  SELECT balance INTO v_balance
  FROM public.client_credit_pools
  WHERE client_org_id = v_org_id;
  IF v_balance <> 15 THEN
    RAISE EXCEPTION 'expected balance 15 after refund, got %', v_balance;
  END IF;

  -- Insufficient does not raise / does not debit
  v_insuf := public.consume_client_credits(v_org_id, 100, NULL, NULL);
  IF (v_insuf->>'ok')::boolean OR (v_insuf->>'error') IS DISTINCT FROM 'insufficient_balance' THEN
    RAISE EXCEPTION 'expected insufficient_balance, got %', v_insuf;
  END IF;

  SELECT balance INTO v_balance
  FROM public.client_credit_pools
  WHERE client_org_id = v_org_id;
  IF v_balance <> 15 THEN
    RAISE EXCEPTION 'insufficient consume mutated balance to %', v_balance;
  END IF;

  -- Partial multi-batch FIFO consume of 7 → 5 from batch1 + 2 from batch2
  v_consume := public.consume_client_credits(v_org_id, 7, NULL, NULL);
  IF NOT (v_consume->>'ok')::boolean THEN
    RAISE EXCEPTION 'partial FIFO consume failed: %', v_consume;
  END IF;

  SELECT units_remaining INTO v_remaining1
  FROM public.client_credit_batches WHERE id = v_batch1;
  SELECT units_remaining INTO v_remaining2
  FROM public.client_credit_batches WHERE id = v_batch2;

  IF v_remaining1 <> 0 OR v_remaining2 <> 8 THEN
    RAISE EXCEPTION 'FIFO residual wrong: batch1=% batch2=%', v_remaining1, v_remaining2;
  END IF;
END $$;

select ok(true, 'client credit ledger: grant/exact consume/FIFO/refund/insufficient');

SELECT * FROM finish();
ROLLBACK;
