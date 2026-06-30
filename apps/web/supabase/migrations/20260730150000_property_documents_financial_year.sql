-- Allow tagging property documents with a UK financial year (e.g. "2024/25"),
-- so editing a document's name/category alongside an FY tag is possible.

ALTER TABLE public.property_documents
  ADD COLUMN IF NOT EXISTS financial_year text;

CREATE INDEX IF NOT EXISTS ix_property_documents_financial_year
  ON public.property_documents(financial_year);

COMMENT ON COLUMN public.property_documents.financial_year IS
  'Optional UK financial year tag for the document, e.g. "2024/25".';

NOTIFY pgrst, 'reload schema';
