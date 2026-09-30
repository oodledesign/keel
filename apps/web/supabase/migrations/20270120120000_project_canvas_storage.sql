-- Images uploaded onto a project canvas. Private bucket; objects live at
-- `{account_id}/{project_id}/{file}` and follow the canvas view/edit rules.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-canvas',
  'project-canvas',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_access_project_canvas_object(
  p_name text,
  p_edit boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uuid constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_parts text[] := storage.foldername(p_name);
  v_account uuid;
  v_project uuid;
BEGIN
  IF coalesce(array_length(v_parts, 1), 0) <> 2
    OR v_parts[1] !~ v_uuid
    OR v_parts[2] !~ v_uuid
  THEN
    RETURN false;
  END IF;

  v_account := v_parts[1]::uuid;
  v_project := v_parts[2]::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = v_project AND p.account_id = v_account
  ) THEN
    RETURN false;
  END IF;

  IF NOT public.can_view_project_canvas(v_project) THEN
    RETURN false;
  END IF;

  RETURN NOT p_edit OR public.can_edit_project_canvas(v_account);
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_project_canvas_object(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_project_canvas_object(text, boolean)
  TO authenticated, service_role;

DROP POLICY IF EXISTS project_canvas_objects_select ON storage.objects;
CREATE POLICY project_canvas_objects_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-canvas'
    AND public.can_access_project_canvas_object(name, false)
  );

DROP POLICY IF EXISTS project_canvas_objects_insert ON storage.objects;
CREATE POLICY project_canvas_objects_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-canvas'
    AND public.can_access_project_canvas_object(name, true)
  );

DROP POLICY IF EXISTS project_canvas_objects_delete ON storage.objects;
CREATE POLICY project_canvas_objects_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-canvas'
    AND public.can_access_project_canvas_object(name, true)
  );
