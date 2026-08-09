-- Allow personal account owners (no memberships row) to use notes/docs/folders
-- and simplified personal projects (projects + project_phases).

-- ---------------------------------------------------------------------------
-- Notes / docs / folders / categories
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS notes_select ON public.notes;
CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS notes_insert ON public.notes;
CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS notes_update ON public.notes;
CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  )
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS notes_delete ON public.notes;
CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS docs_select ON public.docs;
CREATE POLICY docs_select ON public.docs FOR SELECT TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS docs_insert ON public.docs;
CREATE POLICY docs_insert ON public.docs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS docs_update ON public.docs;
CREATE POLICY docs_update ON public.docs FOR UPDATE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  )
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS docs_delete ON public.docs;
CREATE POLICY docs_delete ON public.docs FOR DELETE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_folders_select ON public.note_folders;
CREATE POLICY note_folders_select ON public.note_folders
  FOR SELECT TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_folders_insert ON public.note_folders;
CREATE POLICY note_folders_insert ON public.note_folders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_folders_update ON public.note_folders;
CREATE POLICY note_folders_update ON public.note_folders
  FOR UPDATE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  )
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_folders_delete ON public.note_folders;
CREATE POLICY note_folders_delete ON public.note_folders
  FOR DELETE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_categories_select ON public.note_categories;
CREATE POLICY note_categories_select ON public.note_categories
  FOR SELECT TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_categories_insert ON public.note_categories;
CREATE POLICY note_categories_insert ON public.note_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_categories_update ON public.note_categories;
CREATE POLICY note_categories_update ON public.note_categories
  FOR UPDATE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  )
  WITH CHECK (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS note_categories_delete ON public.note_categories;
CREATE POLICY note_categories_delete ON public.note_categories
  FOR DELETE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR public.has_role_on_account(account_id)
  );

-- ---------------------------------------------------------------------------
-- Projects — personal account owners
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
USING (
  public.is_account_owner(account_id)
  OR (
    public.has_role_on_account(account_id)
    AND NOT public.is_client_on_account(account_id)
    AND (
      NOT public.is_contractor_on_account(account_id)
      OR public.contractor_assigned_to_project(id)
    )
  )
);

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  public.is_account_owner(account_id)
  OR (
    public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account(account_id)
  )
);

DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
USING (
  public.is_account_owner(account_id)
  OR (
    public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account(account_id)
  )
  OR (
    public.is_contractor_on_account(account_id)
    AND public.contractor_assigned_to_project(id)
  )
)
WITH CHECK (
  public.is_account_owner(account_id)
  OR (
    public.has_role_on_account(account_id)
    AND (
      (
        public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account(account_id)
      )
      OR (
        public.is_contractor_on_account(account_id)
        AND public.contractor_assigned_to_project(id)
      )
    )
  )
);

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
USING (
  public.is_account_owner(account_id)
  OR (
    public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account(account_id)
  )
);

-- ---------------------------------------------------------------------------
-- project_phases
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS project_phases_select ON public.project_phases;
CREATE POLICY project_phases_select ON public.project_phases
  FOR SELECT TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR (
      public.has_role_on_account(account_id)
      AND NOT public.is_client_on_account(account_id)
      AND (
        NOT public.is_contractor_on_account(account_id)
        OR public.contractor_assigned_to_project(project_id)
      )
    )
  );

DROP POLICY IF EXISTS project_phases_insert ON public.project_phases;
CREATE POLICY project_phases_insert ON public.project_phases
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_account_owner(account_id)
      OR (
        public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account(account_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_phases.project_id
        AND p.account_id = project_phases.account_id
        AND p.project_type = 'delivery'
    )
  );

DROP POLICY IF EXISTS project_phases_update ON public.project_phases;
CREATE POLICY project_phases_update ON public.project_phases
  FOR UPDATE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR (
      public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(account_id)
    )
  )
  WITH CHECK (
    (
      public.is_account_owner(account_id)
      OR (
        public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account(account_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_phases.project_id
        AND p.account_id = project_phases.account_id
        AND p.project_type = 'delivery'
    )
  );

DROP POLICY IF EXISTS project_phases_delete ON public.project_phases;
CREATE POLICY project_phases_delete ON public.project_phases
  FOR DELETE TO authenticated
  USING (
    public.is_account_owner(account_id)
    OR (
      public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(account_id)
    )
  );

-- Allow personal owners to see delivery-project tasks via ownership (not only membership).
DROP POLICY IF EXISTS tasks_select_via_delivery_project ON public.tasks;
CREATE POLICY tasks_select_via_delivery_project ON public.tasks
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.project_type = 'delivery'
        AND (
          public.is_account_owner(p.account_id)
          OR (
            public.has_role_on_account(p.account_id)
            AND NOT public.is_client_on_account(p.account_id)
            AND (
              NOT public.is_contractor_on_account(p.account_id)
              OR public.contractor_assigned_to_project(p.id)
            )
          )
        )
    )
  );

-- Also enable tasks UPDATE via delivery project for personal owners (membership path).
DROP POLICY IF EXISTS tasks_update_via_delivery_project ON public.tasks;
CREATE POLICY tasks_update_via_delivery_project ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.project_type = 'delivery'
        AND (
          public.is_account_owner(p.account_id)
          OR (
            public.has_permission(
              auth.uid(),
              p.account_id,
              'jobs.edit'::public.app_permissions
            )
            AND NOT public.is_contractor_on_account(p.account_id)
          )
          OR (
            public.is_contractor_on_account(p.account_id)
            AND public.contractor_assigned_to_project(p.id)
          )
        )
    )
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.project_type = 'delivery'
        AND (
          public.is_account_owner(p.account_id)
          OR (
            public.has_permission(
              auth.uid(),
              p.account_id,
              'jobs.edit'::public.app_permissions
            )
            AND NOT public.is_contractor_on_account(p.account_id)
          )
          OR (
            public.is_contractor_on_account(p.account_id)
            AND public.contractor_assigned_to_project(p.id)
          )
        )
    )
  );

NOTIFY pgrst, 'reload schema';
