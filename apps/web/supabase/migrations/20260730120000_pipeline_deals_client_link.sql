-- Pipeline opportunities for existing clients: optional client link on deals.
-- Lets a pipeline card represent a potential project for a current client,
-- alongside the existing free-text "new lead" cards.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pipeline_deals'
  ) THEN
    ALTER TABLE public.pipeline_deals
      ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS ix_pipeline_deals_client_id
      ON public.pipeline_deals(client_id);
    COMMENT ON COLUMN public.pipeline_deals.client_id IS
      'Optional link to an existing client. NULL = new lead (potential client).';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
