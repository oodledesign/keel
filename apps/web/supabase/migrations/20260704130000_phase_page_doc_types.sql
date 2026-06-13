-- Allow phase page and project brief doc types (used by phased project delivery + AI brief).

ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_doc_type_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_doc_type_check CHECK (
  doc_type IS NULL OR doc_type IN (
    'general', 'contract', 'lease', 'insurance', 'inspection',
    'title_deed', 'mortgage', 'tax', 'template', 'other',
    'phase_page', 'project_brief'
  )
);

NOTIFY pgrst, 'reload schema';
