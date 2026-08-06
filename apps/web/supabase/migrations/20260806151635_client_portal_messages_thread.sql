-- Client portal messaging (part 2): thread linking, eligibility helper,
-- get-or-create RPC, and additive RLS. Split from the enum-add migration
-- (20260911091500) because Postgres can't use a new enum value in the same
-- transaction that adds it.

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS client_org_id uuid REFERENCES public.client_orgs (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chat_threads.client_org_id IS
  'Set only for type = client_portal threads: the client_org this thread belongs to.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_threads_client_org_portal
  ON public.chat_threads (account_id, client_org_id)
  WHERE type = 'client_portal' AND client_org_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Eligibility helper (mirrors is_portal_visible_project)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_client_portal_thread_participant(target_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_threads t
    JOIN public.client_members cm ON cm.client_org_id = t.client_org_id
    WHERE t.id = target_thread_id
      AND t.type = 'client_portal'
      AND cm.user_id = (SELECT auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_client_portal_thread_participant(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Get-or-create the single per-org portal thread. SECURITY DEFINER because
-- neither a bare client-portal contact nor a bare team member alone can
-- satisfy chat_threads_insert (created_by = auth.uid() AND
-- has_role_on_account) for the other party's provisioning attempt, and
-- stacking additive INSERT policies for this is more fragile than one
-- authorized function (same pattern as project_guests_set_account_id /
-- task_comments_set_context).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_client_portal_thread(p_client_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
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
    RAISE EXCEPTION 'client org % is not resolvable to a workspace account', p_client_org_id;
  END IF;

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

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  INSERT INTO public.chat_threads (account_id, type, client_org_id, title, created_by)
  VALUES (v_account_id, 'client_portal', p_client_org_id, v_title, (SELECT auth.uid()))
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_client_portal_thread(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: additive policies for type = 'client_portal' rows only. Team side
-- keeps workspace-wide visibility (has_role_on_account), matching how
-- support tickets are workspace-visible today rather than participant-only.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS chat_threads_select_client_portal ON public.chat_threads;
CREATE POLICY chat_threads_select_client_portal
  ON public.chat_threads
  FOR SELECT
  TO authenticated
  USING (
    type = 'client_portal'
    AND (
      public.has_role_on_account(account_id)
      OR public.is_client_portal_thread_participant(id)
    )
  );

DROP POLICY IF EXISTS chat_messages_select_client_portal ON public.chat_messages;
CREATE POLICY chat_messages_select_client_portal
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.type = 'client_portal'
        AND (
          public.has_role_on_account(t.account_id)
          OR public.is_client_portal_thread_participant(t.id)
        )
    )
  );

DROP POLICY IF EXISTS chat_messages_insert_client_portal ON public.chat_messages;
CREATE POLICY chat_messages_insert_client_portal
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.type = 'client_portal'
        AND (
          public.has_role_on_account(t.account_id)
          OR public.is_client_portal_thread_participant(t.id)
        )
    )
  );

DROP POLICY IF EXISTS chat_message_reads_insert_client_portal ON public.chat_message_reads;
CREATE POLICY chat_message_reads_insert_client_portal
  ON public.chat_message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_threads t ON t.id = m.thread_id
      WHERE m.id = chat_message_reads.message_id
        AND t.type = 'client_portal'
        AND public.is_client_portal_thread_participant(t.id)
    )
  );

-- chat_message_reads_select already permits `user_id = auth.uid()` for any
-- row regardless of thread type (base policy from the messages module
-- migration) — no additional select policy needed here.

-- No chat_thread_participants policy changes: the get-or-create function
-- seeds no participant rows, and portal reads never join through that table
-- for type = 'client_portal' — access is checked directly against
-- client_org_id / client_members above.

NOTIFY pgrst, 'reload schema';
