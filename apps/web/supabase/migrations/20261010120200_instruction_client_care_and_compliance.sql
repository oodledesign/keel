-- Client care log + compliance checklist for commercial WIP instructions (pipeline_deals).

CREATE TABLE IF NOT EXISTS public.instruction_client_care_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id uuid NOT NULL REFERENCES public.pipeline_deals (id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_instruction_client_care_log_instruction_created
  ON public.instruction_client_care_log (instruction_id, created_at DESC);

COMMENT ON TABLE public.instruction_client_care_log IS
  'Append-only client care notes for a WIP instruction (last contact / update log).';

CREATE TABLE IF NOT EXISTS public.instruction_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id uuid NOT NULL REFERENCES public.pipeline_deals (id) ON DELETE CASCADE,
  label text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  checked_by uuid REFERENCES auth.users (id),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_instruction_compliance_items_instruction_sort
  ON public.instruction_compliance_items (instruction_id, sort_order);

COMMENT ON TABLE public.instruction_compliance_items IS
  'Per-instruction compliance checklist items for bringing a disposal to market.';

ALTER TABLE public.instruction_client_care_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruction_compliance_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.instruction_client_care_log FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruction_client_care_log TO authenticated;
GRANT ALL ON public.instruction_client_care_log TO service_role;

REVOKE ALL ON public.instruction_compliance_items FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruction_compliance_items TO authenticated;
GRANT ALL ON public.instruction_compliance_items TO service_role;

-- Mirror pipeline_deals access via instruction_id → account_id / business owner.

DROP POLICY IF EXISTS instruction_client_care_log_select ON public.instruction_client_care_log;
CREATE POLICY instruction_client_care_log_select
  ON public.instruction_client_care_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_client_care_log.instruction_id
        AND (
          (d.account_id IS NOT NULL AND public.has_role_on_account(d.account_id))
          OR (
            d.account_id IS NULL
            AND d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS instruction_client_care_log_insert ON public.instruction_client_care_log;
CREATE POLICY instruction_client_care_log_insert
  ON public.instruction_client_care_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_client_care_log.instruction_id
        AND (
          (
            d.account_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.accounts_memberships m
              WHERE m.account_id = d.account_id
                AND m.user_id = auth.uid()
                AND m.account_role::text = ANY (
                  ARRAY['owner'::text, 'admin'::text, 'staff'::text]
                )
            )
          )
          OR (
            d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS instruction_client_care_log_delete ON public.instruction_client_care_log;
CREATE POLICY instruction_client_care_log_delete
  ON public.instruction_client_care_log
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_client_care_log.instruction_id
        AND (
          (
            d.account_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.accounts_memberships m
              WHERE m.account_id = d.account_id
                AND m.user_id = auth.uid()
                AND m.account_role::text = ANY (
                  ARRAY['owner'::text, 'admin'::text, 'staff'::text]
                )
            )
          )
          OR (
            d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS instruction_compliance_items_select ON public.instruction_compliance_items;
CREATE POLICY instruction_compliance_items_select
  ON public.instruction_compliance_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_compliance_items.instruction_id
        AND (
          (d.account_id IS NOT NULL AND public.has_role_on_account(d.account_id))
          OR (
            d.account_id IS NULL
            AND d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS instruction_compliance_items_insert ON public.instruction_compliance_items;
CREATE POLICY instruction_compliance_items_insert
  ON public.instruction_compliance_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_compliance_items.instruction_id
        AND (
          (
            d.account_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.accounts_memberships m
              WHERE m.account_id = d.account_id
                AND m.user_id = auth.uid()
                AND m.account_role::text = ANY (
                  ARRAY['owner'::text, 'admin'::text, 'staff'::text]
                )
            )
          )
          OR (
            d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS instruction_compliance_items_update ON public.instruction_compliance_items;
CREATE POLICY instruction_compliance_items_update
  ON public.instruction_compliance_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_compliance_items.instruction_id
        AND (
          (
            d.account_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.accounts_memberships m
              WHERE m.account_id = d.account_id
                AND m.user_id = auth.uid()
                AND m.account_role::text = ANY (
                  ARRAY['owner'::text, 'admin'::text, 'staff'::text]
                )
            )
          )
          OR (
            d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_compliance_items.instruction_id
        AND (
          (
            d.account_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.accounts_memberships m
              WHERE m.account_id = d.account_id
                AND m.user_id = auth.uid()
                AND m.account_role::text = ANY (
                  ARRAY['owner'::text, 'admin'::text, 'staff'::text]
                )
            )
          )
          OR (
            d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS instruction_compliance_items_delete ON public.instruction_compliance_items;
CREATE POLICY instruction_compliance_items_delete
  ON public.instruction_compliance_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = instruction_compliance_items.instruction_id
        AND (
          (
            d.account_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.accounts_memberships m
              WHERE m.account_id = d.account_id
                AND m.user_id = auth.uid()
                AND m.account_role::text = ANY (
                  ARRAY['owner'::text, 'admin'::text, 'staff'::text]
                )
            )
          )
          OR (
            d.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.businesses b
              WHERE b.id = d.business_id
                AND b.owner_id = auth.uid()
            )
          )
        )
    )
  );
