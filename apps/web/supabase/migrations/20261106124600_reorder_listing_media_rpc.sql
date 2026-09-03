-- Atomic reorder of public listing photos. SECURITY INVOKER so existing
-- commercial_listing_media RLS still applies. First id becomes the cover.

CREATE OR REPLACE FUNCTION public.reorder_commercial_listing_photos(
  p_account_id uuid,
  p_listing_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  missing_id uuid;
BEGIN
  IF p_ordered_ids IS NULL OR cardinality(p_ordered_ids) = 0 THEN
    RAISE EXCEPTION 'media ids required';
  END IF;

  SELECT requested.id
  INTO missing_id
  FROM unnest(p_ordered_ids) AS requested(id)
  LEFT JOIN public.commercial_listing_media AS media
    ON media.id = requested.id
   AND media.listing_id = p_listing_id
   AND media.account_id = p_account_id
   AND media.media_type = 'image'
   AND media.is_private = false
  WHERE media.id IS NULL
  LIMIT 1;

  IF missing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Media not found';
  END IF;

  UPDATE public.commercial_listing_media AS media
  SET
    sort_order = ordered.idx - 1,
    is_cover = (ordered.idx = 1)
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordered(id, idx)
  WHERE media.id = ordered.id
    AND media.listing_id = p_listing_id
    AND media.account_id = p_account_id
    AND media.media_type = 'image'
    AND media.is_private = false;

  -- One cover per listing: first photo wins after a photo reorder.
  UPDATE public.commercial_listing_media
  SET is_cover = false
  WHERE listing_id = p_listing_id
    AND account_id = p_account_id
    AND is_cover = true
    AND id <> p_ordered_ids[1];
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_commercial_listing_photos(uuid, uuid, uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_commercial_listing_photos(uuid, uuid, uuid[])
  TO authenticated, service_role;

COMMENT ON FUNCTION public.reorder_commercial_listing_photos(uuid, uuid, uuid[]) IS
  'Sets public photo sort_order from the given id list (0..n-1) and marks the first photo as cover. RLS still applies.';
