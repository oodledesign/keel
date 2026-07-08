-- Billable vs internal classification on activity blocks.

ALTER TABLE public.activity_blocks
  ADD COLUMN IF NOT EXISTS work_classification text NOT NULL DEFAULT 'neutral';

ALTER TABLE public.activity_blocks
  DROP CONSTRAINT IF EXISTS activity_blocks_work_classification_check;

ALTER TABLE public.activity_blocks
  ADD CONSTRAINT activity_blocks_work_classification_check CHECK (
    work_classification IN ('billable', 'internal', 'neutral')
  );

COMMENT ON COLUMN public.activity_blocks.work_classification IS
  'User-assigned work type: billable client work, internal overhead, or neutral/unset.';

NOTIFY pgrst, 'reload schema';
