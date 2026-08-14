-- Persist which first-visit product tours a user has completed or skipped.
-- Security: covered by existing user_settings RLS (users can only access their own row).
-- No additional policy needed.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS completed_product_tours jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_settings.completed_product_tours IS
  'Map of product tour ids (personal, commercial_property, work_design, work_property, default_landing_prompt, personal_nav_tour_hint) to ISO timestamps when completed or dismissed.';
