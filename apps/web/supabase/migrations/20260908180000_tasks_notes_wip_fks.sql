-- Additive FKs so Tasks and Notes can attach to WIP Instructions / Requirements.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS pipeline_deal_id uuid
    REFERENCES public.pipeline_deals (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commercial_requirement_id uuid
    REFERENCES public.commercial_requirements (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_tasks_account_pipeline_deal
  ON public.tasks (account_id, pipeline_deal_id)
  WHERE pipeline_deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_tasks_account_commercial_requirement
  ON public.tasks (account_id, commercial_requirement_id)
  WHERE commercial_requirement_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.pipeline_deal_id IS
  'Optional WIP Instruction (pipeline_deals) this task belongs to.';
COMMENT ON COLUMN public.tasks.commercial_requirement_id IS
  'Optional commercial requirement this task belongs to.';

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS pipeline_deal_id uuid
    REFERENCES public.pipeline_deals (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commercial_requirement_id uuid
    REFERENCES public.commercial_requirements (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_notes_account_pipeline_deal
  ON public.notes (account_id, pipeline_deal_id)
  WHERE pipeline_deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_notes_account_commercial_requirement
  ON public.notes (account_id, commercial_requirement_id)
  WHERE commercial_requirement_id IS NOT NULL;

COMMENT ON COLUMN public.notes.pipeline_deal_id IS
  'Optional WIP Instruction (pipeline_deals) this note belongs to.';
COMMENT ON COLUMN public.notes.commercial_requirement_id IS
  'Optional commercial requirement this note belongs to.';
