-- Give every commercial listing a deterministic, unique media sort_order.
-- Existing cover images stay first so listing cards / portals do not silently
-- change the hero photo. Remaining items follow created_at then id.

WITH ordered AS (
  SELECT
    id,
    (
      row_number() OVER (
        PARTITION BY listing_id
        ORDER BY is_cover DESC, created_at ASC NULLS LAST, id ASC
      ) - 1
    )::integer AS new_sort_order
  FROM public.commercial_listing_media
)
UPDATE public.commercial_listing_media AS media
SET sort_order = ordered.new_sort_order
FROM ordered
WHERE media.id = ordered.id
  AND media.sort_order IS DISTINCT FROM ordered.new_sort_order;

CREATE INDEX IF NOT EXISTS commercial_listing_media_listing_sort_idx
  ON public.commercial_listing_media (listing_id, sort_order, created_at);

COMMENT ON COLUMN public.commercial_listing_media.sort_order IS
  'Presentation order within a listing. Public photos on the Media tab use 0..n-1; the first photo is the cover.';
