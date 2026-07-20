-- AST (Assured Shorthold Tenancy) property dates + AST document type.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS ast_start_date date,
  ADD COLUMN IF NOT EXISTS ast_end_date date;

COMMENT ON COLUMN public.properties.ast_start_date IS
  'Start date of the current Assured Shorthold Tenancy (AST), if applicable.';
COMMENT ON COLUMN public.properties.ast_end_date IS
  'End / expiry date of the current Assured Shorthold Tenancy (AST), if applicable.';

-- Expand docs.doc_type: add AST, and restore utility/photo from earlier app usage.
ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_doc_type_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_doc_type_check CHECK (
  doc_type IS NULL OR doc_type IN (
    'general',
    'contract',
    'lease',
    'ast',
    'insurance',
    'inspection',
    'title_deed',
    'mortgage',
    'tax',
    'template',
    'utility',
    'photo',
    'other',
    'phase_page',
    'project_brief'
  )
);

NOTIFY pgrst, 'reload schema';
