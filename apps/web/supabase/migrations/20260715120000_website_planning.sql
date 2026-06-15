-- Website planning: sitemap/wireframes on websites, content docs, job link, design template seed.

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sitemap jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS wireframes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.websites.job_id IS
  'Optional PM job this website build is tracked under.';
COMMENT ON COLUMN public.websites.sitemap IS
  'Pages and sections: [{ id, title, slug, sections: [{ id, title, description }] }]';
COMMENT ON COLUMN public.websites.wireframes IS
  'Wireframe sections per page: [{ id, pageId, title, sections: [{ id, sitemapSectionId, title, layout, contentNotes }] }]';

CREATE INDEX IF NOT EXISTS ix_websites_job_id ON public.websites (job_id);

CREATE TABLE IF NOT EXISTS public.website_content_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites (id) ON DELETE CASCADE,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_content_docs IS
  'Markdown content docs for website planning (client copy, references, specs).';

CREATE INDEX IF NOT EXISTS ix_website_content_docs_website_id
  ON public.website_content_docs (website_id, sort_order);

DROP TRIGGER IF EXISTS website_content_docs_set_timestamps ON public.website_content_docs;
CREATE TRIGGER website_content_docs_set_timestamps
  BEFORE INSERT OR UPDATE ON public.website_content_docs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.website_content_docs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_content_docs TO authenticated, service_role;

DROP POLICY IF EXISTS website_content_docs_select ON public.website_content_docs;
CREATE POLICY website_content_docs_select ON public.website_content_docs
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND NOT public.is_client_on_account (account_id)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS website_content_docs_insert ON public.website_content_docs;
CREATE POLICY website_content_docs_insert ON public.website_content_docs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS website_content_docs_update ON public.website_content_docs;
CREATE POLICY website_content_docs_update ON public.website_content_docs
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS website_content_docs_delete ON public.website_content_docs;
CREATE POLICY website_content_docs_delete ON public.website_content_docs
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

-- Seed Website design template (full page_content applied by app on first list if missing).
INSERT INTO public.project_phase_templates (account_id, name, description, phases)
SELECT
  a.id,
  'Website design',
  'AI web design workflow — business context → sitemap → wireframes → content → design → build.',
  '[
    {"name":"Business context","colour":"#3B82F6","description":"Set visual standard and references before opening any design tool.","is_milestone":false,"planning_tab":"overview"},
    {"name":"Sitemaps","colour":"#6366F1","description":"Map every page before design — ~5 minutes with the client.","is_milestone":false,"planning_tab":"sitemap"},
    {"name":"Wireframes","colour":"#8B5CF6","description":"Section structure per page — layout intent, not visual design.","is_milestone":false,"planning_tab":"wireframe"},
    {"name":"Client content","colour":"#14B8A6","description":"Real copy and assets from the client — AI cannot invent this.","is_milestone":false,"planning_tab":"content"},
    {"name":"Design","colour":"#EC4899","description":"Colour system and imagery direction.","is_milestone":false,"planning_tab":"content"},
    {"name":"Typography","colour":"#A855F7","description":"One font max (two if serif + sans pairing).","is_milestone":false,"planning_tab":"content"},
    {"name":"Build","colour":"#2A9D8F","description":"Implement with AI — visual references, not text-only prompts.","is_milestone":true,"planning_tab":"overview"}
  ]'::jsonb
FROM public.accounts a
ON CONFLICT (account_id, name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
