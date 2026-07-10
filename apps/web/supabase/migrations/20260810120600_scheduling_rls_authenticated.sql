-- Scheduling RLS: authenticated workspace members only.
-- NO anonymous / public SELECT — invitee flows must use service-role server routes.
-- Permissions: scheduling.view / scheduling.edit (app_permissions).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_permissions'
      AND e.enumlabel = 'scheduling.view'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'scheduling.view';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_permissions'
      AND e.enumlabel = 'scheduling.edit'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'scheduling.edit';
  END IF;
END $$;

INSERT INTO public.role_permissions (role, permission)
SELECT r.role, p.permission::public.app_permissions
FROM (
  VALUES
    ('owner'),
    ('admin'),
    ('staff')
) AS r(role)
CROSS JOIN (
  VALUES
    ('scheduling.view'),
    ('scheduling.edit')
) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;

/* ------------------------------------------------------------------ */
/* availability_schedules                                              */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS availability_schedules_select ON public.availability_schedules;
CREATE POLICY availability_schedules_select ON public.availability_schedules
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.view'::public.app_permissions)
    OR public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS availability_schedules_insert ON public.availability_schedules;
CREATE POLICY availability_schedules_insert ON public.availability_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS availability_schedules_update ON public.availability_schedules;
CREATE POLICY availability_schedules_update ON public.availability_schedules
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS availability_schedules_delete ON public.availability_schedules;
CREATE POLICY availability_schedules_delete ON public.availability_schedules
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

/* ------------------------------------------------------------------ */
/* availability_rules / overrides (via schedule.account_id)            */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS availability_rules_select ON public.availability_rules;
CREATE POLICY availability_rules_select ON public.availability_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id
        AND (
          public.has_permission(auth.uid(), s.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS availability_rules_insert ON public.availability_rules;
CREATE POLICY availability_rules_insert ON public.availability_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS availability_rules_update ON public.availability_rules;
CREATE POLICY availability_rules_update ON public.availability_rules
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS availability_rules_delete ON public.availability_rules;
CREATE POLICY availability_rules_delete ON public.availability_rules
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS availability_overrides_select ON public.availability_overrides;
CREATE POLICY availability_overrides_select ON public.availability_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_overrides.schedule_id
        AND (
          public.has_permission(auth.uid(), s.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS availability_overrides_insert ON public.availability_overrides;
CREATE POLICY availability_overrides_insert ON public.availability_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_overrides.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS availability_overrides_update ON public.availability_overrides;
CREATE POLICY availability_overrides_update ON public.availability_overrides
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_overrides.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_overrides.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS availability_overrides_delete ON public.availability_overrides;
CREATE POLICY availability_overrides_delete ON public.availability_overrides
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.availability_schedules s
      WHERE s.id = availability_overrides.schedule_id
        AND public.has_permission(auth.uid(), s.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

/* ------------------------------------------------------------------ */
/* booking_pages / event_types                                         */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS booking_pages_select ON public.booking_pages;
CREATE POLICY booking_pages_select ON public.booking_pages
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.view'::public.app_permissions)
    OR public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_pages_insert ON public.booking_pages;
CREATE POLICY booking_pages_insert ON public.booking_pages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_pages_update ON public.booking_pages;
CREATE POLICY booking_pages_update ON public.booking_pages
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_pages_delete ON public.booking_pages;
CREATE POLICY booking_pages_delete ON public.booking_pages
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS event_types_select ON public.event_types;
CREATE POLICY event_types_select ON public.event_types
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.booking_pages bp
      WHERE bp.id = event_types.booking_page_id
        AND (
          public.has_permission(auth.uid(), bp.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS event_types_insert ON public.event_types;
CREATE POLICY event_types_insert ON public.event_types
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.booking_pages bp
      WHERE bp.id = event_types.booking_page_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS event_types_update ON public.event_types;
CREATE POLICY event_types_update ON public.event_types
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.booking_pages bp
      WHERE bp.id = event_types.booking_page_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.booking_pages bp
      WHERE bp.id = event_types.booking_page_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS event_types_delete ON public.event_types;
CREATE POLICY event_types_delete ON public.event_types
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.booking_pages bp
      WHERE bp.id = event_types.booking_page_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

/* ------------------------------------------------------------------ */
/* bookings / guests                                                   */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS bookings_select ON public.bookings;
CREATE POLICY bookings_select ON public.bookings
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.view'::public.app_permissions)
    OR public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS bookings_insert ON public.bookings;
CREATE POLICY bookings_insert ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS bookings_update ON public.bookings;
CREATE POLICY bookings_update ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS bookings_delete ON public.bookings;
CREATE POLICY bookings_delete ON public.bookings
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_guests_select ON public.booking_guests;
CREATE POLICY booking_guests_select ON public.booking_guests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_guests.booking_id
        AND (
          public.has_permission(auth.uid(), b.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS booking_guests_insert ON public.booking_guests;
CREATE POLICY booking_guests_insert ON public.booking_guests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_guests.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_guests_update ON public.booking_guests;
CREATE POLICY booking_guests_update ON public.booking_guests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_guests.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_guests.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_guests_delete ON public.booking_guests;
CREATE POLICY booking_guests_delete ON public.booking_guests
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_guests.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

/* ------------------------------------------------------------------ */
/* forms                                                               */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS booking_form_fields_select ON public.booking_form_fields;
CREATE POLICY booking_form_fields_select ON public.booking_form_fields
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.event_types et
      JOIN public.booking_pages bp ON bp.id = et.booking_page_id
      WHERE et.id = booking_form_fields.event_type_id
        AND (
          public.has_permission(auth.uid(), bp.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS booking_form_fields_insert ON public.booking_form_fields;
CREATE POLICY booking_form_fields_insert ON public.booking_form_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.event_types et
      JOIN public.booking_pages bp ON bp.id = et.booking_page_id
      WHERE et.id = booking_form_fields.event_type_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_form_fields_update ON public.booking_form_fields;
CREATE POLICY booking_form_fields_update ON public.booking_form_fields
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.event_types et
      JOIN public.booking_pages bp ON bp.id = et.booking_page_id
      WHERE et.id = booking_form_fields.event_type_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.event_types et
      JOIN public.booking_pages bp ON bp.id = et.booking_page_id
      WHERE et.id = booking_form_fields.event_type_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_form_fields_delete ON public.booking_form_fields;
CREATE POLICY booking_form_fields_delete ON public.booking_form_fields
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.event_types et
      JOIN public.booking_pages bp ON bp.id = et.booking_page_id
      WHERE et.id = booking_form_fields.event_type_id
        AND public.has_permission(auth.uid(), bp.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_form_responses_select ON public.booking_form_responses;
CREATE POLICY booking_form_responses_select ON public.booking_form_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_form_responses.booking_id
        AND (
          public.has_permission(auth.uid(), b.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS booking_form_responses_insert ON public.booking_form_responses;
CREATE POLICY booking_form_responses_insert ON public.booking_form_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_form_responses.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_form_responses_update ON public.booking_form_responses;
CREATE POLICY booking_form_responses_update ON public.booking_form_responses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_form_responses.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_form_responses.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_form_responses_delete ON public.booking_form_responses;
CREATE POLICY booking_form_responses_delete ON public.booking_form_responses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_form_responses.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

/* ------------------------------------------------------------------ */
/* notifications / reminders                                           */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS booking_notification_settings_select
  ON public.booking_notification_settings;
CREATE POLICY booking_notification_settings_select
  ON public.booking_notification_settings
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.view'::public.app_permissions)
    OR public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_notification_settings_insert
  ON public.booking_notification_settings;
CREATE POLICY booking_notification_settings_insert
  ON public.booking_notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_notification_settings_update
  ON public.booking_notification_settings;
CREATE POLICY booking_notification_settings_update
  ON public.booking_notification_settings
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_notification_settings_delete
  ON public.booking_notification_settings;
CREATE POLICY booking_notification_settings_delete
  ON public.booking_notification_settings
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS booking_reminders_select ON public.booking_reminders;
CREATE POLICY booking_reminders_select ON public.booking_reminders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_reminders.booking_id
        AND (
          public.has_permission(auth.uid(), b.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS booking_reminders_insert ON public.booking_reminders;
CREATE POLICY booking_reminders_insert ON public.booking_reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_reminders.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_reminders_update ON public.booking_reminders;
CREATE POLICY booking_reminders_update ON public.booking_reminders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_reminders.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_reminders.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS booking_reminders_delete ON public.booking_reminders;
CREATE POLICY booking_reminders_delete ON public.booking_reminders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_reminders.booking_id
        AND public.has_permission(auth.uid(), b.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

/* ------------------------------------------------------------------ */
/* conferencing                                                        */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS conferencing_connections_select
  ON public.conferencing_connections;
CREATE POLICY conferencing_connections_select
  ON public.conferencing_connections
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.view'::public.app_permissions)
    OR public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS conferencing_connections_insert
  ON public.conferencing_connections;
CREATE POLICY conferencing_connections_insert
  ON public.conferencing_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS conferencing_connections_update
  ON public.conferencing_connections;
CREATE POLICY conferencing_connections_update
  ON public.conferencing_connections
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS conferencing_connections_delete
  ON public.conferencing_connections;
CREATE POLICY conferencing_connections_delete
  ON public.conferencing_connections
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

NOTIFY pgrst, 'reload schema';
