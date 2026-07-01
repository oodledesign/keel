-- Agency client portal branding (subdomain: {slug}.ozer.so → /portal/{slug}).

CREATE TABLE IF NOT EXISTS public.agency_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  brand_name text,
  custom_domain text,
  logo_url text,
  favicon_url text,
  primary_colour text,
  support_email text,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_branding_slug_unique UNIQUE (slug)
);

ALTER TABLE public.agency_branding
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS agency_branding_slug_idx
  ON public.agency_branding (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_agency_branding_business_id
  ON public.agency_branding (business_id);

COMMENT ON TABLE public.agency_branding IS
  'Per-workspace agency portal branding; slug powers {slug}.ozer.so subdomains.';

DROP TRIGGER IF EXISTS agency_branding_set_timestamps ON public.agency_branding;
CREATE TRIGGER agency_branding_set_timestamps
  BEFORE INSERT OR UPDATE ON public.agency_branding
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.agency_branding ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_branding TO authenticated, service_role;

DROP POLICY IF EXISTS agency_branding_select ON public.agency_branding;
CREATE POLICY agency_branding_select ON public.agency_branding
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(business_id));

DROP POLICY IF EXISTS agency_branding_insert ON public.agency_branding;
CREATE POLICY agency_branding_insert ON public.agency_branding
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(business_id));

DROP POLICY IF EXISTS agency_branding_update ON public.agency_branding;
CREATE POLICY agency_branding_update ON public.agency_branding
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(business_id))
  WITH CHECK (public.has_role_on_account(business_id));

DROP POLICY IF EXISTS agency_branding_delete ON public.agency_branding;
CREATE POLICY agency_branding_delete ON public.agency_branding
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(business_id));

NOTIFY pgrst, 'reload schema';
