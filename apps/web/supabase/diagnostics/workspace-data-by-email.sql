-- Run in Supabase Dashboard → SQL Editor.
-- Set your email once in diag_workspace_params below, then run the entire script.
--
-- Handles schema drift: public.projects may use account_id (MakerKit team) OR
-- business_id → businesses. clients.account_id may reference accounts(id) or
-- businesses(id). If businesses has no account_id column, counts are grouped by
-- business UUID only (see rollup note in payload).

BEGIN;

SET LOCAL statement_timeout = '60s';

DROP TABLE IF EXISTS diag_workspace_params;
CREATE TEMP TABLE diag_workspace_params (email text PRIMARY KEY);
INSERT INTO diag_workspace_params VALUES ('dan@oodle.design');

DROP TABLE IF EXISTS diag_workspace_tmp_memberships;
CREATE TEMP TABLE diag_workspace_tmp_memberships AS
WITH u AS (
  SELECT id AS user_id, au.email
  FROM auth.users au
  JOIN diag_workspace_params p ON au.email = p.email
  LIMIT 1
)
SELECT m.user_id,
       m.account_id,
       m.account_role,
       m.company_role,
       a.name,
       a.slug,
       a.is_personal_account
FROM public.accounts_memberships m
JOIN public.accounts a ON a.id = m.account_id
JOIN u ON u.user_id = m.user_id;

DROP TABLE IF EXISTS diag_workspace_user;
CREATE TEMP TABLE diag_workspace_user AS
SELECT id AS user_id
FROM auth.users au
JOIN diag_workspace_params p ON au.email = p.email
LIMIT 1;

DROP TABLE IF EXISTS diag_workspace_results;
CREATE TEMP TABLE diag_workspace_results (
  step text PRIMARY KEY,
  payload jsonb NOT NULL
);

INSERT INTO diag_workspace_results (step, payload)
SELECT '0_schema_projects_clients',
       jsonb_build_object(
         'projects_columns', COALESCE(
           (SELECT jsonb_agg(c.column_name ORDER BY c.ordinal_position)
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = 'projects'),
           '[]'::jsonb
         ),
         'clients_account_id_fk_to', COALESCE(
           (SELECT ccu.table_name::text
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_schema = kcu.constraint_schema
             AND tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_schema = tc.constraint_schema
             AND ccu.constraint_name = tc.constraint_name
            WHERE tc.table_schema = 'public'
              AND tc.table_name = 'clients'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'account_id'
            LIMIT 1),
           'unknown'
         ),
         'businesses_columns', COALESCE(
           (SELECT jsonb_agg(c.column_name ORDER BY c.ordinal_position)
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = 'businesses'),
           '[]'::jsonb
         )
       );

INSERT INTO diag_workspace_results (step, payload)
SELECT '1_memberships',
       COALESCE(jsonb_agg(to_jsonb(diag_workspace_tmp_memberships.*)), '[]'::jsonb)
FROM diag_workspace_tmp_memberships;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = 'account_module_settings'
  ) THEN
    INSERT INTO diag_workspace_results (step, payload)
    SELECT '2_account_module_settings',
           COALESCE(
             (
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'account_id', ams.account_id,
                   'module_key', ams.module_key,
                   'enabled', ams.enabled
                 )
               )
               FROM public.account_module_settings ams
               WHERE ams.account_id IN (
                 SELECT account_id FROM diag_workspace_tmp_memberships WHERE NOT is_personal_account
               )
             ),
             '[]'::jsonb
           );
  ELSE
    INSERT INTO diag_workspace_results (step, payload)
    VALUES (
      '2_account_module_settings',
      jsonb_build_object('note', 'table public.account_module_settings does not exist')
    );
  END IF;
END $$;

DO $$
DECLARE
  proj_has_account_id boolean;
  proj_has_business_id boolean;
  bus_has_account_id boolean;
  clients_fk_table text;
  acc_ids uuid[];
  payload jsonb;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT account_id), ARRAY[]::uuid[])
  INTO acc_ids
  FROM diag_workspace_tmp_memberships;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'projects' AND c.column_name = 'account_id'
  ) INTO proj_has_account_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'projects' AND c.column_name = 'business_id'
  ) INTO proj_has_business_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'businesses' AND c.column_name = 'account_id'
  ) INTO bus_has_account_id;

  SELECT ccu.table_name::text
  INTO clients_fk_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema
   AND tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_schema = tc.constraint_schema
   AND ccu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'clients'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'account_id'
  LIMIT 1;

  IF proj_has_account_id THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    INTO payload
    FROM (
      SELECT account_id::text AS team_account_id, COUNT(*)::bigint AS n
      FROM public.projects
      WHERE account_id = ANY (acc_ids)
      GROUP BY account_id
    ) x;
  ELSIF proj_has_business_id AND bus_has_account_id THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    INTO payload
    FROM (
      SELECT b.account_id::text AS team_account_id, COUNT(*)::bigint AS n
      FROM public.projects p
      JOIN public.businesses b ON b.id = p.business_id
      WHERE b.account_id = ANY (acc_ids)
      GROUP BY b.account_id
    ) x;
  ELSIF proj_has_business_id THEN
    SELECT jsonb_build_object(
      'rollup', 'by_business_id_only',
      'note', 'projects.business_id → businesses.id but public.businesses has no account_id; counts are per business UUID.',
      'rows',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(x)::jsonb)
          FROM (
            SELECT p.business_id::text AS business_id, COUNT(*)::bigint AS n
            FROM public.projects p
            GROUP BY p.business_id
          ) x
        ),
        '[]'::jsonb
      )
    )
    INTO payload;
  ELSE
    payload := jsonb_build_object(
      'error', 'Cannot aggregate projects: need projects.account_id OR projects.business_id',
      'proj_has_account_id', proj_has_account_id,
      'proj_has_business_id', proj_has_business_id,
      'businesses_has_account_id', bus_has_account_id
    );
  END IF;

  INSERT INTO diag_workspace_results (step, payload)
  VALUES ('3_projects_count_by_team_account', payload);

  IF clients_fk_table = 'businesses' AND bus_has_account_id THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    INTO payload
    FROM (
      SELECT b.account_id::text AS team_account_id, COUNT(*)::bigint AS n
      FROM public.clients cl
      JOIN public.businesses b ON b.id = cl.account_id
      WHERE b.account_id = ANY (acc_ids)
      GROUP BY b.account_id
    ) x;
  ELSIF clients_fk_table = 'businesses' THEN
    SELECT jsonb_build_object(
      'rollup', 'by_business_id_only',
      'note', 'clients.account_id → businesses.id but public.businesses has no account_id; compare business_id to team workspace manually.',
      'rows',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(x)::jsonb)
          FROM (
            SELECT cl.account_id::text AS business_id, COUNT(*)::bigint AS n
            FROM public.clients cl
            GROUP BY cl.account_id
          ) x
        ),
        '[]'::jsonb
      )
    )
    INTO payload;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public' AND col.table_name = 'clients' AND col.column_name = 'account_id'
  ) THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    INTO payload
    FROM (
      SELECT account_id::text AS team_account_id, COUNT(*)::bigint AS n
      FROM public.clients
      WHERE account_id = ANY (acc_ids)
      GROUP BY account_id
    ) x;
  ELSE
    payload := jsonb_build_object('error', 'public.clients has no account_id column');
  END IF;

  INSERT INTO diag_workspace_results (step, payload)
  VALUES ('4_clients_count_by_team_account', payload);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public' AND col.table_name = 'jobs' AND col.column_name = 'account_id'
  ) THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    INTO payload
    FROM (
      SELECT account_id::text AS team_account_id, COUNT(*)::bigint AS n
      FROM public.jobs
      WHERE account_id = ANY (acc_ids)
      GROUP BY account_id
    ) x;
  ELSE
    payload := jsonb_build_object(
      'note', 'public.jobs has no account_id column; skipped counts',
      'jobs_columns',
      COALESCE(
        (SELECT jsonb_agg(col.column_name ORDER BY col.ordinal_position)
         FROM information_schema.columns col
         WHERE col.table_schema = 'public' AND col.table_name = 'jobs'),
        '[]'::jsonb
      )
    );
  END IF;

  INSERT INTO diag_workspace_results (step, payload)
  VALUES ('5_jobs_count_by_team_account', payload);
END $$;

INSERT INTO diag_workspace_results (step, payload)
SELECT '6_tasks_for_user',
       CASE
         WHEN NOT EXISTS (SELECT 1 FROM diag_workspace_user) THEN
           jsonb_build_object('note', 'no auth.users row for email in diag_workspace_params')
         ELSE COALESCE(
           (
             SELECT to_jsonb(c)
             FROM (
               SELECT COUNT(*)::bigint AS total,
                      COUNT(*) FILTER (WHERE project_id IS NOT NULL)::bigint AS with_project,
                      COUNT(*) FILTER (WHERE client_id IS NOT NULL)::bigint AS with_client
               FROM public.tasks t
               WHERE t.user_id = (SELECT user_id FROM diag_workspace_user)
             ) c
           ),
           '{}'::jsonb
         )
       END;

INSERT INTO diag_workspace_results (step, payload)
SELECT '7_has_permission_clients_edit',
       CASE
         WHEN NOT EXISTS (SELECT 1 FROM diag_workspace_user) THEN
           jsonb_build_object('note', 'no auth.users row — cannot call has_permission')
         ELSE COALESCE(
           (
             SELECT jsonb_agg(
               jsonb_build_object(
                 'account_id', m.account_id::text,
                 'can_edit',
                 public.has_permission(
                   (SELECT user_id FROM diag_workspace_user),
                   m.account_id,
                   'clients.edit'::public.app_permissions
                 )
               )
             )
             FROM diag_workspace_tmp_memberships m
             WHERE NOT m.is_personal_account
           ),
           '[]'::jsonb
         )
       END;

COMMIT;

SELECT step, payload
FROM diag_workspace_results
ORDER BY step;
