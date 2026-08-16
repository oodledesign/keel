-- Per-cook ratings for family recipes (additive). Popularity is computed, not stored.

CREATE TABLE IF NOT EXISTS public.family_recipe_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.family_recipes(id) ON DELETE CASCADE,
  logged_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  cooked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_family_recipe_logs_recipe_id
  ON public.family_recipe_logs(recipe_id);

CREATE INDEX IF NOT EXISTS ix_family_recipe_logs_recipe_cooked
  ON public.family_recipe_logs(recipe_id, cooked_at DESC);

COMMENT ON TABLE public.family_recipe_logs IS
  'One row per cook of a family recipe. Ratings accumulate — never overwrite a single score.';

COMMENT ON COLUMN public.family_recipe_logs.rating IS
  'Optional 1–5 score for this cook. Null means cooked without a rating.';

-- Computed popularity: avg_rating * ln(times_cooked + 1)
CREATE OR REPLACE VIEW public.family_recipe_popularity
  WITH (security_invoker = true) AS
SELECT
  recipe_id,
  count(*)::integer AS times_cooked,
  avg(rating) FILTER (WHERE rating IS NOT NULL)::numeric AS avg_rating,
  (
    coalesce(avg(rating) FILTER (WHERE rating IS NOT NULL), 0)
    * ln((count(*))::numeric + 1)
  )::numeric AS popularity_score
FROM public.family_recipe_logs
GROUP BY recipe_id;

COMMENT ON VIEW public.family_recipe_popularity IS
  'Popularity score = avg_rating * ln(times_cooked + 1). Recomputed on read.';

ALTER TABLE public.family_recipe_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipe_logs TO authenticated, service_role;
GRANT SELECT ON public.family_recipe_popularity TO authenticated, service_role;

-- Access follows the parent recipe (personal owner OR workspace member).
DROP POLICY IF EXISTS family_recipe_logs_select ON public.family_recipe_logs;
CREATE POLICY family_recipe_logs_select ON public.family_recipe_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_recipes r
      WHERE r.id = recipe_id
        AND (
          (r.account_id IS NULL AND r.user_id = (SELECT auth.uid()))
          OR (r.account_id IS NOT NULL AND public.has_role_on_account(r.account_id))
        )
    )
  );

DROP POLICY IF EXISTS family_recipe_logs_insert ON public.family_recipe_logs;
CREATE POLICY family_recipe_logs_insert ON public.family_recipe_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    logged_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.family_recipes r
      WHERE r.id = recipe_id
        AND (
          (r.account_id IS NULL AND r.user_id = (SELECT auth.uid()))
          OR (r.account_id IS NOT NULL AND public.has_role_on_account(r.account_id))
        )
    )
  );

DROP POLICY IF EXISTS family_recipe_logs_update ON public.family_recipe_logs;
CREATE POLICY family_recipe_logs_update ON public.family_recipe_logs
  FOR UPDATE TO authenticated
  USING (
    logged_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.family_recipes r
      WHERE r.id = recipe_id
        AND (
          (r.account_id IS NULL AND r.user_id = (SELECT auth.uid()))
          OR (r.account_id IS NOT NULL AND public.has_role_on_account(r.account_id))
        )
    )
  )
  WITH CHECK (
    logged_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.family_recipes r
      WHERE r.id = recipe_id
        AND (
          (r.account_id IS NULL AND r.user_id = (SELECT auth.uid()))
          OR (r.account_id IS NOT NULL AND public.has_role_on_account(r.account_id))
        )
    )
  );

DROP POLICY IF EXISTS family_recipe_logs_delete ON public.family_recipe_logs;
CREATE POLICY family_recipe_logs_delete ON public.family_recipe_logs
  FOR DELETE TO authenticated
  USING (
    logged_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.family_recipes r
      WHERE r.id = recipe_id
        AND (
          (r.account_id IS NULL AND r.user_id = (SELECT auth.uid()))
          OR (r.account_id IS NOT NULL AND public.has_role_on_account(r.account_id))
        )
    )
  );

NOTIFY pgrst, 'reload schema';
