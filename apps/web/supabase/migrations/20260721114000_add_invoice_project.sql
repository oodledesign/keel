-- Allow an entire invoice to be associated with one project.
-- Line-item project assignments remain independent and optional.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS project_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_project_id_fkey'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES public.projects(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_invoices_project_id
  ON public.invoices(project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.project_id IS
  'Optional project associated with the invoice as a whole; line items may retain their own project assignments.';

CREATE OR REPLACE FUNCTION public.validate_invoice_project_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = NEW.project_id
      AND project.account_id = NEW.account_id
      AND project.client_id = NEW.client_id
      AND project.project_type = 'delivery'
  ) THEN
    RAISE EXCEPTION
      'Invoice project must belong to the same account and client'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_validate_project_scope ON public.invoices;
CREATE TRIGGER invoices_validate_project_scope
  BEFORE INSERT OR UPDATE OF account_id, client_id, project_id
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invoice_project_scope();

COMMENT ON FUNCTION public.validate_invoice_project_scope() IS
  'Ensures an invoice-level project belongs to the same workspace and client as the invoice.';
