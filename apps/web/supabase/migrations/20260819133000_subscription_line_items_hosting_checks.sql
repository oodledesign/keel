-- Production subscription_line_items predates G2 and still CHECKs one-off
-- extras only. Hosting/retainer attach inserts item_type = recurring_price
-- and status = active, which PostgREST rejects with 400 after the
-- client_subscriptions row is created.

ALTER TABLE public.subscription_line_items
  DROP CONSTRAINT IF EXISTS subscription_line_items_item_type_check;

ALTER TABLE public.subscription_line_items
  ADD CONSTRAINT subscription_line_items_item_type_check
  CHECK (
    item_type = ANY (
      ARRAY[
        'one-off'::text,
        'recurring-addon'::text,
        'credit'::text,
        'recurring_price'::text
      ]
    )
  );

ALTER TABLE public.subscription_line_items
  DROP CONSTRAINT IF EXISTS subscription_line_items_status_check;

ALTER TABLE public.subscription_line_items
  ADD CONSTRAINT subscription_line_items_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'invoiced'::text,
        'paid'::text,
        'waived'::text,
        'active'::text
      ]
    )
  );
