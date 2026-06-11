-- Business workspace messaging (ported from Tradeways) + note/doc attachments.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chat_thread_type'
  ) THEN
    CREATE TYPE public.chat_thread_type AS ENUM ('direct', 'group', 'job');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'chat_participant_kind'
  ) THEN
    CREATE TYPE public.chat_participant_kind AS ENUM ('member', 'client');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  type public.chat_thread_type NOT NULL,
  title text,
  job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_threads IS 'Conversation containers for direct/group/job-linked chats.';

CREATE TABLE IF NOT EXISTS public.chat_thread_participants (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  participant_kind public.chat_participant_kind NOT NULL,
  participant_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  participant_client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  archived_at timestamptz,
  UNIQUE (thread_id, participant_user_id),
  UNIQUE (thread_id, participant_client_id),
  CONSTRAINT chat_thread_participants_kind_check CHECK (
    (participant_kind = 'member' AND participant_user_id IS NOT NULL AND participant_client_id IS NULL)
    OR
    (participant_kind = 'client' AND participant_client_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.chat_thread_participants IS 'Participants for each chat thread.';

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  body text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.chat_messages IS 'Message entries belonging to chat threads.';

CREATE TABLE IF NOT EXISTS public.chat_message_reads (
  message_id uuid NOT NULL REFERENCES public.chat_messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

COMMENT ON TABLE public.chat_message_reads IS 'Per-user read receipts for chat messages.';

CREATE TABLE IF NOT EXISTS public.chat_message_attachments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES public.chat_messages (id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('note', 'doc')),
  attachment_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, attachment_type, attachment_id)
);

COMMENT ON TABLE public.chat_message_attachments IS
  'Links chat messages to workspace notes or uploaded docs the recipient can view.';

CREATE INDEX IF NOT EXISTS idx_chat_threads_account_last_message
  ON public.chat_threads (account_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_threads_job
  ON public.chat_threads (job_id);

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_thread
  ON public.chat_thread_participants (thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_user
  ON public.chat_thread_participants (participant_user_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_user_active
  ON public.chat_thread_participants (participant_user_id, thread_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_client
  ON public.chat_thread_participants (participant_client_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON public.chat_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_not_deleted
  ON public.chat_messages (thread_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_user_read_at
  ON public.chat_message_reads (user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message
  ON public.chat_message_reads (message_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_attachments_message
  ON public.chat_message_attachments (message_id);

CREATE OR REPLACE FUNCTION public.is_chat_thread_participant(thread_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_thread_participants p
    WHERE p.thread_id = is_chat_thread_participant.thread_id
      AND p.participant_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_thread_participant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_threads_set_updated_at()
RETURNS trigger
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_threads_set_updated_at_trigger ON public.chat_threads;
CREATE TRIGGER chat_threads_set_updated_at_trigger
BEFORE UPDATE ON public.chat_threads
FOR EACH ROW
EXECUTE FUNCTION public.chat_threads_set_updated_at();

CREATE OR REPLACE FUNCTION public.chat_messages_touch_thread()
RETURNS trigger
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_threads
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_touch_thread_trigger ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_thread_trigger
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.chat_messages_touch_thread();

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_threads_select ON public.chat_threads;
CREATE POLICY chat_threads_select ON public.chat_threads
FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND public.is_chat_thread_participant(id)
);

DROP POLICY IF EXISTS chat_threads_insert ON public.chat_threads;
CREATE POLICY chat_threads_insert ON public.chat_threads
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.has_role_on_account(account_id)
);

DROP POLICY IF EXISTS chat_threads_update ON public.chat_threads;
CREATE POLICY chat_threads_update ON public.chat_threads
FOR UPDATE TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND public.is_chat_thread_participant(id)
)
WITH CHECK (
  public.has_role_on_account(account_id)
  AND public.is_chat_thread_participant(id)
);

DROP POLICY IF EXISTS chat_thread_participants_select ON public.chat_thread_participants;
CREATE POLICY chat_thread_participants_select ON public.chat_thread_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_thread_participants.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_thread_participants_insert ON public.chat_thread_participants;
CREATE POLICY chat_thread_participants_insert ON public.chat_thread_participants
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_thread_participants.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_thread_participants_update ON public.chat_thread_participants;
CREATE POLICY chat_thread_participants_update ON public.chat_thread_participants
FOR UPDATE TO authenticated
USING (
  participant_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_thread_participants.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
)
WITH CHECK (
  participant_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_thread_participants.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_messages_update ON public.chat_messages;
CREATE POLICY chat_messages_update ON public.chat_messages
FOR UPDATE TO authenticated
USING (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE t.id = chat_messages.thread_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
)
WITH CHECK (
  sender_user_id = auth.uid()
);

DROP POLICY IF EXISTS chat_message_reads_select ON public.chat_message_reads;
CREATE POLICY chat_message_reads_select ON public.chat_message_reads
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.chat_messages m
    JOIN public.chat_threads t ON t.id = m.thread_id
    WHERE m.id = chat_message_reads.message_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_message_reads_insert ON public.chat_message_reads;
CREATE POLICY chat_message_reads_insert ON public.chat_message_reads
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    JOIN public.chat_threads t ON t.id = m.thread_id
    WHERE m.id = chat_message_reads.message_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_message_attachments_select ON public.chat_message_attachments;
CREATE POLICY chat_message_attachments_select ON public.chat_message_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_messages m
    JOIN public.chat_threads t ON t.id = m.thread_id
    WHERE m.id = chat_message_attachments.message_id
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

DROP POLICY IF EXISTS chat_message_attachments_insert ON public.chat_message_attachments;
CREATE POLICY chat_message_attachments_insert ON public.chat_message_attachments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_messages m
    JOIN public.chat_threads t ON t.id = m.thread_id
    WHERE m.id = chat_message_attachments.message_id
      AND m.sender_user_id = auth.uid()
      AND public.has_role_on_account(t.account_id)
      AND public.is_chat_thread_participant(t.id)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_thread_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT ON public.chat_message_reads TO authenticated;
GRANT SELECT, INSERT ON public.chat_message_attachments TO authenticated;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_thread_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_thread_participants;
  END IF;
END $$;

-- Module seed: add messages to full business workspaces
CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text DEFAULT NULL,
  p_business_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  keys text[];
  k text;
  normalized_space text;
  normalized_biz text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'calendar', 'meal_plan', 'shopping',
      'notes', 'team', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'messages', true
FROM public.accounts a
WHERE lower(coalesce(a.space_type, 'work')) = 'work'
  AND NOT EXISTS (
    SELECT 1 FROM public.account_module_settings ams
    WHERE ams.account_id = a.id AND ams.module_key = 'messages'
  )
ON CONFLICT (account_id, module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
