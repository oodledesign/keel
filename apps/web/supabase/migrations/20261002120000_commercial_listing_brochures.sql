-- Editable PDF brochure documents per commercial listing (slot-based pages).

CREATE TABLE IF NOT EXISTS public.commercial_listing_brochures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  template_id text NOT NULL DEFAULT 'classic'
    CHECK (template_id IN ('classic', 'editorial', 'compact')),
  page_size text NOT NULL DEFAULT 'A4'
    CHECK (page_size IN ('A4')),
  orientation text NOT NULL DEFAULT 'portrait'
    CHECK (orientation IN ('portrait', 'landscape')),
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_listing_brochures_listing_orient_uidx
    UNIQUE (listing_id, orientation)
);

CREATE INDEX IF NOT EXISTS commercial_listing_brochures_account_id_idx
  ON public.commercial_listing_brochures (account_id);

CREATE INDEX IF NOT EXISTS commercial_listing_brochures_listing_id_idx
  ON public.commercial_listing_brochures (listing_id);

COMMENT ON TABLE public.commercial_listing_brochures IS
  'Slot-based brochure page documents for PDF generation and the Freeprints-style editor.';

ALTER TABLE public.commercial_listing_brochures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_listing_brochures FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_brochures TO authenticated;
GRANT ALL ON public.commercial_listing_brochures TO service_role;

DROP POLICY IF EXISTS commercial_listing_brochures_select
  ON public.commercial_listing_brochures;
CREATE POLICY commercial_listing_brochures_select
  ON public.commercial_listing_brochures
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_brochures_insert
  ON public.commercial_listing_brochures;
CREATE POLICY commercial_listing_brochures_insert
  ON public.commercial_listing_brochures
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_brochures_update
  ON public.commercial_listing_brochures;
CREATE POLICY commercial_listing_brochures_update
  ON public.commercial_listing_brochures
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_brochures_delete
  ON public.commercial_listing_brochures;
CREATE POLICY commercial_listing_brochures_delete
  ON public.commercial_listing_brochures
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE OR REPLACE FUNCTION public.set_commercial_listing_brochures_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_listing_brochures_set_updated_at
  ON public.commercial_listing_brochures;
CREATE TRIGGER commercial_listing_brochures_set_updated_at
  BEFORE UPDATE ON public.commercial_listing_brochures
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_listing_brochures_updated_at();
