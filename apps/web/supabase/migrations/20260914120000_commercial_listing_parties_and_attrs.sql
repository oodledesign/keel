-- Landlords / other listing parties + advanced management attributes.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS hide_landlord_from_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS average_floor_plate_sqft numeric,
  ADD COLUMN IF NOT EXISTS size_breakdown text,
  ADD COLUMN IF NOT EXISTS controlled_by text,
  ADD COLUMN IF NOT EXISTS size_accuracy text,
  ADD COLUMN IF NOT EXISTS terms_internal text,
  ADD COLUMN IF NOT EXISTS breeam_rating text,
  ADD COLUMN IF NOT EXISTS condition_description text;

COMMENT ON COLUMN public.commercial_listings.hide_landlord_from_marketing IS
  'When true, landlord names are omitted from marketplace / portal marketing.';
COMMENT ON COLUMN public.commercial_listings.reference_number IS
  'Internal agency reference for the disposal.';
COMMENT ON COLUMN public.commercial_listings.project_code IS
  'Optional internal project code.';
COMMENT ON COLUMN public.commercial_listings.average_floor_plate_sqft IS
  'Average floor plate size in sq ft.';
COMMENT ON COLUMN public.commercial_listings.size_breakdown IS
  'How sizes are broken down (e.g. floor_by_floor, total_only).';
COMMENT ON COLUMN public.commercial_listings.controlled_by IS
  'Who controls the instruction (agent, landlord, vendor).';
COMMENT ON COLUMN public.commercial_listings.size_accuracy IS
  'Accuracy of sizes (approximate, measured, estimated).';
COMMENT ON COLUMN public.commercial_listings.terms_internal IS
  'Internal comment on terms (not for marketing).';
COMMENT ON COLUMN public.commercial_listings.breeam_rating IS
  'BREEAM rating label when known.';
COMMENT ON COLUMN public.commercial_listings.condition_description IS
  'Short condition description.';

CREATE TABLE IF NOT EXISTS public.commercial_listing_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('landlord', 'other')),
  contact_name text,
  contact_email text,
  contact_phone text,
  is_private boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_listing_parties_listing_client_role_uidx
    UNIQUE (listing_id, client_id, role)
);

CREATE INDEX IF NOT EXISTS commercial_listing_parties_listing_id_idx
  ON public.commercial_listing_parties (listing_id);
CREATE INDEX IF NOT EXISTS commercial_listing_parties_account_id_idx
  ON public.commercial_listing_parties (account_id);
CREATE INDEX IF NOT EXISTS commercial_listing_parties_role_idx
  ON public.commercial_listing_parties (listing_id, role);

COMMENT ON TABLE public.commercial_listing_parties IS
  'Landlords and other related contacts/companies linked to a commercial disposal.';

CREATE OR REPLACE FUNCTION public.commercial_listing_parties_account_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  listing_account uuid;
  client_account uuid;
BEGIN
  SELECT account_id INTO listing_account
  FROM public.commercial_listings
  WHERE id = NEW.listing_id;

  SELECT account_id INTO client_account
  FROM public.clients
  WHERE id = NEW.client_id;

  IF listing_account IS NULL OR client_account IS NULL THEN
    RAISE EXCEPTION 'listing party listing or client not found';
  END IF;

  IF listing_account <> NEW.account_id OR client_account <> NEW.account_id THEN
    RAISE EXCEPTION 'listing party listing, client, and account_id must match';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_listing_parties_account_guard_trg
  ON public.commercial_listing_parties;
CREATE TRIGGER commercial_listing_parties_account_guard_trg
  BEFORE INSERT OR UPDATE ON public.commercial_listing_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.commercial_listing_parties_account_guard();

ALTER TABLE public.commercial_listing_parties ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_listing_parties FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_parties TO authenticated;
GRANT ALL ON public.commercial_listing_parties TO service_role;

DROP POLICY IF EXISTS commercial_listing_parties_select ON public.commercial_listing_parties;
CREATE POLICY commercial_listing_parties_select ON public.commercial_listing_parties
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_parties_insert ON public.commercial_listing_parties;
CREATE POLICY commercial_listing_parties_insert ON public.commercial_listing_parties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS commercial_listing_parties_update ON public.commercial_listing_parties;
CREATE POLICY commercial_listing_parties_update ON public.commercial_listing_parties
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

DROP POLICY IF EXISTS commercial_listing_parties_delete ON public.commercial_listing_parties;
CREATE POLICY commercial_listing_parties_delete ON public.commercial_listing_parties
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

-- Backfill primary instructing client as a landlord party when present.
INSERT INTO public.commercial_listing_parties (
  listing_id,
  account_id,
  client_id,
  role,
  sort_order
)
SELECT
  l.id,
  l.account_id,
  l.instructing_client_id,
  'landlord',
  0
FROM public.commercial_listings l
WHERE l.instructing_client_id IS NOT NULL
ON CONFLICT (listing_id, client_id, role) DO NOTHING;
