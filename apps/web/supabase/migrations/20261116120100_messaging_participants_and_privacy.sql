-- Unified messaging: visibility is participants only (workspace members and/or
-- client contacts). Portal org-wide bypass is removed. Existing client_portal
-- threads are seeded so old messages stay visible to the people who should
-- have been on them.

-- ---------------------------------------------------------------------------
-- Thread + participant columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL;

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS is_client_wide boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chat_threads.client_id IS
  'CRM client this thread is linked to (client page + whole-client preset).';

COMMENT ON COLUMN public.chat_threads.is_client_wide IS
  'When true, newly portal-enabled contacts for client_id are auto-added. Direct/group stay false.';

CREATE INDEX IF NOT EXISTS idx_chat_threads_client
  ON public.chat_threads (client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.chat_thread_participants
  ADD COLUMN IF NOT EXISTS participant_contact_id uuid REFERENCES public.contacts (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.chat_thread_participants.participant_contact_id IS
  'Client contact participant. Other contacts at the same business are not implied.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_thread_participants_contact
  ON public.chat_thread_participants (thread_id, participant_contact_id)
  WHERE participant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_contact
  ON public.chat_thread_participants (participant_contact_id, thread_id)
  WHERE participant_contact_id IS NOT NULL;

ALTER TABLE public.chat_thread_participants
  DROP CONSTRAINT IF EXISTS chat_thread_participants_kind_check;

ALTER TABLE public.chat_thread_participants
  ADD CONSTRAINT chat_thread_participants_kind_check CHECK (
    (
      participant_kind = 'member'
      AND participant_user_id IS NOT NULL
      AND participant_client_id IS NULL
      AND participant_contact_id IS NULL
    )
    OR (
      participant_kind = 'client'
      AND participant_client_id IS NOT NULL
      AND participant_contact_id IS NULL
    )
    OR (
      participant_kind = 'contact'
      AND participant_contact_id IS NOT NULL
      AND participant_client_id IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- Auth user → contact ids (portal invite or contacts.user_id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.chat_contact_ids_for_auth_user()
RETURNS TABLE (contact_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT c.id
  FROM public.contacts c
  WHERE c.user_id = (SELECT auth.uid())

  UNION

  SELECT DISTINCT i.contact_id
  FROM public.client_portal_invites i
  WHERE i.user_id = (SELECT auth.uid())
    AND i.status = 'accepted'
    AND i.contact_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.chat_contact_ids_for_auth_user() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_chat_thread_participant(thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_thread_participants p
    WHERE p.thread_id = is_chat_thread_participant.thread_id
      AND p.archived_at IS NULL
      AND (
        p.participant_user_id = (SELECT auth.uid())
        OR (
          p.participant_contact_id IS NOT NULL
          AND p.participant_contact_id IN (
            SELECT public.chat_contact_ids_for_auth_user()
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_thread_participant(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: participants only. Portal contacts are not workspace members, so
-- SELECT/INSERT on messages cannot require has_role_on_account.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS chat_threads_select ON public.chat_threads;
CREATE POLICY chat_threads_select ON public.chat_threads
FOR SELECT TO authenticated
USING (public.is_chat_thread_participant(id));

DROP POLICY IF EXISTS chat_threads_select_client_portal ON public.chat_threads;

DROP POLICY IF EXISTS chat_threads_update ON public.chat_threads;
CREATE POLICY chat_threads_update ON public.chat_threads
FOR UPDATE TO authenticated
USING (
  public.is_chat_thread_participant(id)
  AND public.has_role_on_account(account_id)
)
WITH CHECK (
  public.is_chat_thread_participant(id)
  AND public.has_role_on_account(account_id)
);

DROP POLICY IF EXISTS chat_thread_participants_select ON public.chat_thread_participants;
CREATE POLICY chat_thread_participants_select ON public.chat_thread_participants
FOR SELECT TO authenticated
USING (public.is_chat_thread_participant(thread_id));

DROP POLICY IF EXISTS chat_thread_participants_insert ON public.chat_thread_participants;
CREATE POLICY chat_thread_participants_insert ON public.chat_thread_participants
FOR INSERT TO authenticated
WITH CHECK (
  public.is_chat_thread_participant(thread_id)
  AND public.has_role_on_account((
    SELECT t.account_id FROM public.chat_threads t
    WHERE t.id = chat_thread_participants.thread_id
  ))
);

DROP POLICY IF EXISTS chat_thread_participants_update ON public.chat_thread_participants;
CREATE POLICY chat_thread_participants_update ON public.chat_thread_participants
FOR UPDATE TO authenticated
USING (
  participant_user_id = (SELECT auth.uid())
  OR (
    participant_contact_id IS NOT NULL
    AND participant_contact_id IN (
      SELECT public.chat_contact_ids_for_auth_user()
    )
  )
)
WITH CHECK (
  participant_user_id = (SELECT auth.uid())
  OR (
    participant_contact_id IS NOT NULL
    AND participant_contact_id IN (
      SELECT public.chat_contact_ids_for_auth_user()
    )
  )
);

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
FOR SELECT TO authenticated
USING (public.is_chat_thread_participant(thread_id));

DROP POLICY IF EXISTS chat_messages_select_client_portal ON public.chat_messages;

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = (SELECT auth.uid())
  AND public.is_chat_thread_participant(thread_id)
);

DROP POLICY IF EXISTS chat_messages_insert_client_portal ON public.chat_messages;

DROP POLICY IF EXISTS chat_messages_update ON public.chat_messages;
CREATE POLICY chat_messages_update ON public.chat_messages
FOR UPDATE TO authenticated
USING (
  sender_user_id = (SELECT auth.uid())
  AND public.is_chat_thread_participant(thread_id)
)
WITH CHECK (sender_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS chat_message_reads_select ON public.chat_message_reads;
CREATE POLICY chat_message_reads_select ON public.chat_message_reads
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_message_reads.message_id
      AND public.is_chat_thread_participant(m.thread_id)
  )
);

DROP POLICY IF EXISTS chat_message_reads_insert ON public.chat_message_reads;
CREATE POLICY chat_message_reads_insert ON public.chat_message_reads
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_message_reads.message_id
      AND public.is_chat_thread_participant(m.thread_id)
  )
);

DROP POLICY IF EXISTS chat_message_reads_insert_client_portal ON public.chat_message_reads;

DROP POLICY IF EXISTS chat_message_attachments_select ON public.chat_message_attachments;
CREATE POLICY chat_message_attachments_select ON public.chat_message_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_message_attachments.message_id
      AND public.is_chat_thread_participant(m.thread_id)
  )
);

DROP POLICY IF EXISTS chat_message_attachments_insert ON public.chat_message_attachments;
CREATE POLICY chat_message_attachments_insert ON public.chat_message_attachments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_message_attachments.message_id
      AND m.sender_user_id = (SELECT auth.uid())
      AND public.is_chat_thread_participant(m.thread_id)
  )
);

-- ---------------------------------------------------------------------------
-- Seed helpers: portal-enabled contacts + sensible workspace members
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_enabled_contact_ids_for_client(p_client_id uuid)
RETURNS TABLE (contact_id uuid, user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT
    i.contact_id,
    i.user_id
  FROM public.client_portal_invites i
  WHERE i.client_id = p_client_id
    AND i.status = 'accepted'
    AND i.contact_id IS NOT NULL

  UNION

  SELECT DISTINCT
    cc.contact_id,
    cm.user_id
  FROM public.clients cl
  JOIN public.client_contacts cc ON cc.client_id = cl.id
  JOIN public.contacts c ON c.id = cc.contact_id
  JOIN public.client_members cm ON cm.client_org_id = cl.client_org_id
  JOIN public.accounts a
    ON a.id = cm.user_id
   AND a.is_personal_account = true
   AND lower(trim(a.email)) = lower(trim(c.email))
  WHERE cl.id = p_client_id
    AND cl.client_org_id IS NOT NULL
    AND c.email IS NOT NULL
    AND length(trim(c.email)) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.portal_enabled_contact_ids_for_client(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.seed_client_wide_thread_participants(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
  v_client_id uuid;
  v_client_org_id uuid;
  v_created_by uuid;
BEGIN
  SELECT t.account_id, t.client_id, t.client_org_id, t.created_by
    INTO v_account_id, v_client_id, v_client_org_id, v_created_by
  FROM public.chat_threads t
  WHERE t.id = p_thread_id;

  IF v_account_id IS NULL THEN
    RETURN;
  END IF;

  IF v_client_id IS NULL AND v_client_org_id IS NOT NULL THEN
    SELECT cl.id INTO v_client_id
    FROM public.clients cl
    WHERE cl.client_org_id = v_client_org_id
      AND cl.account_id = v_account_id
    ORDER BY cl.created_at ASC
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      UPDATE public.chat_threads
      SET client_id = v_client_id,
          is_client_wide = true
      WHERE id = p_thread_id;
    END IF;
  END IF;

  -- Workspace members: owner + anyone who already sent a message on this thread.
  INSERT INTO public.chat_thread_participants (
    thread_id, participant_kind, participant_user_id
  )
  SELECT p_thread_id, 'member', u.user_id
  FROM (
    SELECT a.primary_owner_user_id AS user_id
    FROM public.accounts a
    WHERE a.id = v_account_id
      AND a.primary_owner_user_id IS NOT NULL

    UNION

    SELECT t.created_by
    FROM public.chat_threads t
    WHERE t.id = p_thread_id
      AND t.created_by IS NOT NULL

    UNION

    SELECT m.sender_user_id
    FROM public.chat_messages m
    WHERE m.thread_id = p_thread_id
      AND m.sender_user_id IS NOT NULL

    UNION

    SELECT am.user_id
    FROM public.accounts_memberships am
    WHERE am.account_id = v_account_id
      AND am.account_role IN ('owner', 'admin', 'staff')
  ) u
  WHERE u.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = v_account_id
        AND am.user_id = u.user_id
        AND coalesce(am.account_role, '') <> 'client'
    )
  ON CONFLICT (thread_id, participant_user_id) DO NOTHING;

  IF v_client_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_thread_participants (
    thread_id, participant_kind, participant_contact_id, participant_user_id
  )
  SELECT
    p_thread_id,
    'contact',
    pec.contact_id,
    CASE
      WHEN pec.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.chat_thread_participants existing_user
          WHERE existing_user.thread_id = p_thread_id
            AND existing_user.participant_user_id = pec.user_id
        )
        THEN NULL
      ELSE pec.user_id
    END
  FROM public.portal_enabled_contact_ids_for_client(v_client_id) pec
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.chat_thread_participants existing
    WHERE existing.thread_id = p_thread_id
      AND existing.participant_contact_id = pec.contact_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_client_wide_thread_participants(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.add_contact_to_client_wide_threads(
  p_client_id uuid,
  p_contact_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.chat_thread_participants (
    thread_id, participant_kind, participant_contact_id, participant_user_id
  )
  SELECT
    t.id,
    'contact',
    p_contact_id,
    CASE
      WHEN p_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.chat_thread_participants existing_user
          WHERE existing_user.thread_id = t.id
            AND existing_user.participant_user_id = p_user_id
        )
        THEN NULL
      ELSE p_user_id
    END
  FROM public.chat_threads t
  WHERE t.client_id = p_client_id
    AND t.is_client_wide = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.chat_thread_participants existing
      WHERE existing.thread_id = t.id
        AND existing.participant_contact_id = p_contact_id
    );

  IF p_user_id IS NOT NULL THEN
    UPDATE public.chat_thread_participants p
    SET participant_user_id = p_user_id
    FROM public.chat_threads t
    WHERE p.thread_id = t.id
      AND t.client_id = p_client_id
      AND t.is_client_wide = true
      AND p.participant_contact_id = p_contact_id
      AND p.participant_user_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.chat_thread_participants existing_user
        WHERE existing_user.thread_id = p.thread_id
          AND existing_user.participant_user_id = p_user_id
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_contact_to_client_wide_threads(uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- get_or_create: seed participants; mark whole-client
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_client_portal_thread(p_client_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
  v_client_id uuid;
  v_thread_id uuid;
  v_title text;
  v_authorized boolean;
BEGIN
  SELECT co.name INTO v_title
  FROM public.client_orgs co
  WHERE co.id = p_client_org_id;

  SELECT b.account_id INTO v_account_id
  FROM public.client_orgs co
  JOIN public.businesses b ON b.id = co.business_id
  WHERE co.id = p_client_org_id;

  IF v_account_id IS NULL THEN
    SELECT co.business_id INTO v_account_id
    FROM public.client_orgs co
    WHERE co.id = p_client_org_id
      AND EXISTS (
        SELECT 1 FROM public.accounts a WHERE a.id = co.business_id
      );
  END IF;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'client org % is not resolvable to a workspace account', p_client_org_id;
  END IF;

  SELECT cl.id INTO v_client_id
  FROM public.clients cl
  WHERE cl.client_org_id = p_client_org_id
    AND cl.account_id = v_account_id
  ORDER BY cl.created_at ASC
  LIMIT 1;

  SELECT
    EXISTS (
      SELECT 1 FROM public.client_members cm
      WHERE cm.client_org_id = p_client_org_id AND cm.user_id = (SELECT auth.uid())
    )
    OR public.has_role_on_account(v_account_id)
  INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized for this client org';
  END IF;

  SELECT id INTO v_thread_id
  FROM public.chat_threads
  WHERE account_id = v_account_id
    AND client_org_id = p_client_org_id
    AND type = 'client_portal';

  IF v_thread_id IS NULL THEN
    INSERT INTO public.chat_threads (
      account_id, type, client_org_id, client_id, is_client_wide, title, created_by
    )
    VALUES (
      v_account_id,
      'client_portal',
      p_client_org_id,
      v_client_id,
      true,
      v_title,
      (SELECT auth.uid())
    )
    RETURNING id INTO v_thread_id;
  ELSE
    UPDATE public.chat_threads
    SET is_client_wide = true,
        client_id = coalesce(client_id, v_client_id)
    WHERE id = v_thread_id;
  END IF;

  PERFORM public.seed_client_wide_thread_participants(v_thread_id);

  -- Ensure the caller is on the thread (portal contact or team member).
  IF (SELECT auth.uid()) IS NOT NULL THEN
    INSERT INTO public.chat_thread_participants (
      thread_id, participant_kind, participant_user_id
    )
    SELECT v_thread_id, 'member', (SELECT auth.uid())
    WHERE public.has_role_on_account(v_account_id)
    ON CONFLICT (thread_id, participant_user_id) DO NOTHING;

    INSERT INTO public.chat_thread_participants (
      thread_id, participant_kind, participant_contact_id, participant_user_id
    )
    SELECT
      v_thread_id,
      'contact',
      ids.contact_id,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.chat_thread_participants existing_user
          WHERE existing_user.thread_id = v_thread_id
            AND existing_user.participant_user_id = (SELECT auth.uid())
        ) THEN NULL
        ELSE (SELECT auth.uid())
      END
    FROM public.chat_contact_ids_for_auth_user() ids
    JOIN public.client_contacts cc ON cc.contact_id = ids.contact_id
    WHERE v_client_id IS NOT NULL
      AND cc.client_id = v_client_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.chat_thread_participants existing
        WHERE existing.thread_id = v_thread_id
          AND existing.participant_contact_id = ids.contact_id
      );
  END IF;

  RETURN v_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_client_portal_thread(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill existing portal threads
-- Choice: portal-enabled contacts for the linked client + account owner +
-- staff/admin members + anyone who already sent a message. Direct/group
-- threads are not touched and never auto-add later.
-- ---------------------------------------------------------------------------

UPDATE public.chat_threads
SET is_client_wide = true
WHERE type = 'client_portal';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.chat_threads WHERE type = 'client_portal'
  LOOP
    PERFORM public.seed_client_wide_thread_participants(r.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
