-- Project logos for delivery projects + portal visibility of phases.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS picture_url text;

COMMENT ON COLUMN public.projects.picture_url IS
  'Optional project logo / avatar (public account_image storage URL).';

-- Portal contacts can view phases for portal_visible projects (read-only).
DROP POLICY IF EXISTS project_phases_select_client_portal ON public.project_phases;
CREATE POLICY project_phases_select_client_portal
  ON public.project_phases
  FOR SELECT
  TO authenticated
  USING (public.is_portal_visible_project(project_id));

NOTIFY pgrst, 'reload schema';
