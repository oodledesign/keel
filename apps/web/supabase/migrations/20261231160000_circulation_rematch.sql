-- Circulation: optionally re-notify contacts when a listing they were already
-- sent gets a material change (price drop, or back on the market).
--
-- Detection is a trigger so every write path is covered (edit form, imports,
-- Kato / Property Hive feeds). It only stamps the listing. Whether that causes
-- an email is decided at send time by the workspace toggles below, by comparing
-- the stamps with commercial_circulation_sent_listings.last_sent_at, so no
-- sent-history is ever deleted and flipping a toggle needs no backfill.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS price_dropped_at timestamptz,
  ADD COLUMN IF NOT EXISTS relisted_at timestamptz;

COMMENT ON COLUMN public.commercial_listings.price_dropped_at IS
  'Last price drop of 5% or more, worth re-notifying matched contacts about. Cleared if the price is later raised. Set by trigger.';
COMMENT ON COLUMN public.commercial_listings.relisted_at IS
  'Last time the listing returned to marketing from under offer, let, sold or withdrawn. Set by trigger.';

-- Two columns rather than one "latest change" so a relist and a price drop in
-- the same update are both kept: each workspace toggle looks at its own.
CREATE OR REPLACE FUNCTION public.commercial_listings_track_material_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  rent_dropped boolean;
  price_dropped boolean;
  rent_rose boolean;
  price_rose boolean;
BEGIN
  -- Both old and new must be real prices. Going to or from "POA" (null / 0)
  -- is not a price drop. bigint maths avoids int4 overflow on large prices.
  rent_dropped :=
    coalesce(OLD.asking_rent_pence, 0) > 0
    AND coalesce(NEW.asking_rent_pence, 0) > 0
    AND NEW.asking_rent_pence::bigint * 100 <= OLD.asking_rent_pence::bigint * 95;
  price_dropped :=
    coalesce(OLD.asking_price_pence, 0) > 0
    AND coalesce(NEW.asking_price_pence, 0) > 0
    AND NEW.asking_price_pence::bigint * 100 <= OLD.asking_price_pence::bigint * 95;
  rent_rose :=
    coalesce(OLD.asking_rent_pence, 0) > 0
    AND coalesce(NEW.asking_rent_pence, 0) > OLD.asking_rent_pence;
  price_rose :=
    coalesce(OLD.asking_price_pence, 0) > 0
    AND coalesce(NEW.asking_price_pence, 0) > OLD.asking_price_pence;

  IF NEW.status = 'marketing'
     AND OLD.status IN ('under_offer', 'let', 'sold', 'withdrawn') THEN
    NEW.relisted_at := now();
  END IF;

  IF rent_dropped OR price_dropped THEN
    NEW.price_dropped_at := now();
  ELSIF rent_rose OR price_rose THEN
    -- A correction (typo fixed, price put back up) cancels a pending drop so
    -- contacts are not told about a price that no longer exists.
    NEW.price_dropped_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_listings_track_material_change
  ON public.commercial_listings;
CREATE TRIGGER commercial_listings_track_material_change
  BEFORE UPDATE OF status, asking_rent_pence, asking_price_pence
  ON public.commercial_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.commercial_listings_track_material_change();

-- Workspace toggles. Off by default: this is opt-in behaviour.
ALTER TABLE public.commercial_circulation_settings
  ADD COLUMN IF NOT EXISTS rematch_on_price_drop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rematch_on_relist boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.commercial_circulation_settings.rematch_on_price_drop IS
  'Re-send a listing to contacts already sent it when its price drops 5% or more.';
COMMENT ON COLUMN public.commercial_circulation_settings.rematch_on_relist IS
  'Re-send a listing to contacts already sent it when it returns to marketing after being under offer, let, sold or withdrawn.';
