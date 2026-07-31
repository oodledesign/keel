-- One agency branding row per workspace account.
CREATE UNIQUE INDEX IF NOT EXISTS agency_branding_business_id_key
  ON public.agency_branding (business_id);
