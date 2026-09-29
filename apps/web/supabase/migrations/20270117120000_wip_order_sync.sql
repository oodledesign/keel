-- One shared manual order for the commercial WIP ladder, board and sheet.
--
-- * Requirements get a `board_position` so the team can order them within a
--   stage (they had no manual order; the board fell back to row id).
-- * Instructions already carry `ladder_position` and `board_position`. The app
--   now keeps them equal on every write; this brings existing rows in line,
--   using the ladder order as the source of truth.

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS board_position integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.commercial_requirements.board_position IS
  'Manual sort order within a WIP stage (lower first). Shared by the board and the sheet.';

-- Seed requirements: newest first within each account + stage (new rows default
-- to 0, so they also land at the top).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY account_id, stage
      ORDER BY created_at DESC NULLS LAST, id ASC
    )::integer AS pos
  FROM public.commercial_requirements
)
UPDATE public.commercial_requirements AS r
SET board_position = ranked.pos
FROM ranked
WHERE r.id = ranked.id
  AND r.board_position = 0;

CREATE INDEX IF NOT EXISTS ix_commercial_requirements_account_stage_position
  ON public.commercial_requirements (account_id, stage, board_position);

-- Keep the previous instruction positions so this can be reverted.
CREATE TABLE IF NOT EXISTS public.wip_position_backup_20270117 (
  id uuid PRIMARY KEY,
  ladder_position integer NOT NULL,
  board_position integer NOT NULL
);
ALTER TABLE public.wip_position_backup_20270117 ENABLE ROW LEVEL SECURITY;

-- Only commercial workspaces use the ladder; leave every other account alone.
WITH commercial_accounts AS (
  SELECT account_id FROM public.commercial_listings
  UNION
  SELECT account_id FROM public.commercial_requirements
),
ranked AS (
  SELECT
    d.id,
    row_number() OVER (
      PARTITION BY d.account_id, d.stage
      ORDER BY d.ladder_position ASC, d.id ASC
    )::integer AS pos
  FROM public.pipeline_deals AS d
  WHERE d.account_id IN (SELECT account_id FROM commercial_accounts)
),
changed AS (
  SELECT d.id, d.ladder_position, d.board_position, ranked.pos
  FROM public.pipeline_deals AS d
  JOIN ranked ON ranked.id = d.id
  WHERE d.ladder_position <> ranked.pos OR d.board_position <> ranked.pos
),
saved AS (
  INSERT INTO public.wip_position_backup_20270117 (id, ladder_position, board_position)
  SELECT id, ladder_position, board_position FROM changed
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
UPDATE public.pipeline_deals AS d
SET ladder_position = changed.pos,
    board_position = changed.pos
FROM changed
WHERE d.id = changed.id;
