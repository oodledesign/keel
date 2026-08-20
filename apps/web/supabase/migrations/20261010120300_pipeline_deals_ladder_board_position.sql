-- Manual ordering for commercial WIP ladder and board views (separate fields).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_deals'
      AND column_name = 'ladder_position'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ADD COLUMN ladder_position integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_deals'
      AND column_name = 'board_position'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ADD COLUMN board_position integer;
  END IF;
END $$;

COMMENT ON COLUMN public.pipeline_deals.ladder_position IS
  'Manual sort order within the WIP ladder view (lower first). Fallen-through rows still sort last.';
COMMENT ON COLUMN public.pipeline_deals.board_position IS
  'Manual sort order within a WIP board column (lower first).';

-- Backfill: by stage then created_at within each account (or business for legacy rows).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY COALESCE(account_id::text, business_id::text, 'none'), stage
      ORDER BY created_at ASC NULLS LAST, id ASC
    )::integer AS pos
  FROM public.pipeline_deals
)
UPDATE public.pipeline_deals AS d
SET
  ladder_position = COALESCE(d.ladder_position, ranked.pos),
  board_position = COALESCE(d.board_position, ranked.pos)
FROM ranked
WHERE d.id = ranked.id
  AND (d.ladder_position IS NULL OR d.board_position IS NULL);

ALTER TABLE public.pipeline_deals
  ALTER COLUMN ladder_position SET DEFAULT 0,
  ALTER COLUMN board_position SET DEFAULT 0;

UPDATE public.pipeline_deals
SET
  ladder_position = COALESCE(ladder_position, 0),
  board_position = COALESCE(board_position, 0)
WHERE ladder_position IS NULL OR board_position IS NULL;

ALTER TABLE public.pipeline_deals
  ALTER COLUMN ladder_position SET NOT NULL,
  ALTER COLUMN board_position SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_pipeline_deals_account_stage_ladder
  ON public.pipeline_deals (account_id, stage, ladder_position);

CREATE INDEX IF NOT EXISTS ix_pipeline_deals_account_stage_board
  ON public.pipeline_deals (account_id, stage, board_position);
