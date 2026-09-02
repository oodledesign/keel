-- Shopfront photo for brochure contact pages (workspace branch settings).

ALTER TABLE public.account_branches
  ADD COLUMN IF NOT EXISTS shopfront_url text;

COMMENT ON COLUMN public.account_branches.shopfront_url IS
  'Public URL of the office shopfront photo. Shown on commercial brochure contact pages when set.';
