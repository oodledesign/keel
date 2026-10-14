-- Instagram Automation v2: sequences, assets, contacts, runs and message events.
-- Additive only: legacy ig_triggers columns (match_type, scope, dm_*) and
-- ig_dm_sessions are kept untouched.

-- ---------------------------------------------------------------------------
-- ig_triggers: new trigger fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.ig_triggers
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'comment_keyword',
  ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'contains',
  ADD COLUMN IF NOT EXISTS media_scope text NOT NULL DEFAULT 'any_post',
  ADD COLUMN IF NOT EXISTS media_id text,
  ADD COLUMN IF NOT EXISTS require_follow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS once_per_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooldown_minutes integer,
  ADD COLUMN IF NOT EXISTS entry_payload text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ig_triggers_trigger_type_check'
  ) THEN
    ALTER TABLE public.ig_triggers
      ADD CONSTRAINT ig_triggers_trigger_type_check CHECK (
        trigger_type IN (
          'comment_keyword', 'story_reply', 'story_mention', 'dm_keyword',
          'first_message', 'ice_breaker', 'menu_payload'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ig_triggers_match_mode_check'
  ) THEN
    ALTER TABLE public.ig_triggers
      ADD CONSTRAINT ig_triggers_match_mode_check
      CHECK (match_mode IN ('contains', 'exact', 'any'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ig_triggers_media_scope_check'
  ) THEN
    ALTER TABLE public.ig_triggers
      ADD CONSTRAINT ig_triggers_media_scope_check
      CHECK (media_scope IN ('any_post', 'specific_post', 'reels', 'stories'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ig_triggers_cooldown_minutes_check'
  ) THEN
    ALTER TABLE public.ig_triggers
      ADD CONSTRAINT ig_triggers_cooldown_minutes_check
      CHECK (cooldown_minutes IS NULL OR cooldown_minutes BETWEEN 0 AND 43200);
  END IF;
END $$;

COMMENT ON COLUMN public.ig_triggers.trigger_type IS
  'What starts the automation. There is no on-follow trigger: Meta does not send follow webhooks.';
COMMENT ON COLUMN public.ig_triggers.match_mode IS
  'contains | exact | any. Legacy match_type (incl. regex) still applies when match_mode is not any.';
COMMENT ON COLUMN public.ig_triggers.entry_payload IS
  'Payload for ice_breaker / menu_payload triggers.';

CREATE INDEX IF NOT EXISTS ix_ig_triggers_ig_account_type_active
  ON public.ig_triggers (ig_account_id, trigger_type, is_active);

-- ---------------------------------------------------------------------------
-- ig_automation_assets: audio / image / video / pdf library
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ig_automation_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('audio', 'image', 'video', 'pdf')),
  source text NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'recording', 'tts')),
  original_path text,
  original_mime_type text,
  delivery_path text,
  mime_type text,
  size_bytes bigint,
  duration_ms integer,
  waveform jsonb,
  transcode_status text NOT NULL DEFAULT 'pending'
    CHECK (transcode_status IN ('pending', 'processing', 'ready', 'failed')),
  transcode_error text,
  meta_attachment_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_clone_consent_at timestamptz,
  consenting_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.ig_automation_assets.meta_attachment_ids IS
  'Reusable Meta attachment ids keyed by ig_connected_accounts.id. Never stores URLs.';

CREATE INDEX IF NOT EXISTS ix_ig_automation_assets_account
  ON public.ig_automation_assets (account_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- ig_automation_steps: ordered sequence per trigger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ig_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.ig_triggers (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  step_type text NOT NULL CHECK (
    step_type IN (
      'text', 'audio', 'image', 'video', 'pdf', 'delay', 'quick_replies',
      'buttons', 'collect_data', 'tag', 'condition', 'handoff'
    )
  ),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  asset_id uuid REFERENCES public.ig_automation_assets (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_automation_steps_trigger_position_unique
    UNIQUE (trigger_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS ix_ig_automation_steps_account
  ON public.ig_automation_steps (account_id);
CREATE INDEX IF NOT EXISTS ix_ig_automation_steps_asset
  ON public.ig_automation_steps (asset_id);

-- ---------------------------------------------------------------------------
-- ig_contacts: Instagram-scoped users who have interacted with the account
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ig_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  igsid text NOT NULL,
  username text,
  display_name text,
  last_inbound_at timestamptz,
  opted_out_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  is_follower boolean,
  is_follower_checked_at timestamptz,
  handoff_at timestamptz,
  consent jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_contacts_igsid_unique UNIQUE (ig_account_id, igsid)
);

COMMENT ON COLUMN public.ig_contacts.last_inbound_at IS
  'Last message/postback from the user. Drives the 24-hour messaging window.';
COMMENT ON COLUMN public.ig_contacts.consent IS
  'UK GDPR consent records: [{purpose, wording, granted, recorded_at, source_message_id}].';

CREATE INDEX IF NOT EXISTS ix_ig_contacts_account_inbound
  ON public.ig_contacts (account_id, last_inbound_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ix_ig_contacts_tags
  ON public.ig_contacts USING gin (tags);
CREATE INDEX IF NOT EXISTS ix_ig_contacts_linked_client
  ON public.ig_contacts (linked_client_id);

-- ---------------------------------------------------------------------------
-- ig_automation_runs: one execution of a trigger's sequence for a contact
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ig_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.ig_contacts (id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.ig_triggers (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (
    source IN (
      'comment', 'message', 'postback', 'story_reply', 'story_mention',
      'ice_breaker', 'menu', 'test'
    )
  ),
  source_event_id text NOT NULL,
  source_comment_id text,
  private_reply_used boolean NOT NULL DEFAULT false,
  current_position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN (
      'active', 'waiting_delay', 'waiting_reply', 'completed', 'handed_off',
      'stopped', 'failed', 'window_expired'
    )
  ),
  awaiting jsonb,
  next_step_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_automation_runs_source_unique UNIQUE (trigger_id, source_event_id)
);

COMMENT ON COLUMN public.ig_automation_runs.awaiting IS
  'What the run is waiting for: {kind: quick_reply|button|collect_data|follow, ...}.';

CREATE INDEX IF NOT EXISTS ix_ig_automation_runs_due
  ON public.ig_automation_runs (status, next_step_at)
  WHERE status IN ('active', 'waiting_delay');
CREATE INDEX IF NOT EXISTS ix_ig_automation_runs_contact
  ON public.ig_automation_runs (contact_id, status);
CREATE INDEX IF NOT EXISTS ix_ig_automation_runs_account_created
  ON public.ig_automation_runs (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_ig_automation_runs_trigger
  ON public.ig_automation_runs (trigger_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- ig_message_events: inbound + outbound log with send idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ig_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.ig_contacts (id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.ig_automation_runs (id) ON DELETE SET NULL,
  trigger_id uuid REFERENCES public.ig_triggers (id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  event_type text NOT NULL CHECK (
    event_type IN (
      'message', 'quick_reply', 'postback', 'comment', 'story_reply',
      'story_mention', 'private_reply', 'step', 'agent', 'system'
    )
  ),
  step_position integer,
  step_type text,
  send_status text NOT NULL DEFAULT 'queued' CHECK (
    send_status IN (
      'received', 'queued', 'sent', 'failed', 'skipped', 'window_expired'
    )
  ),
  body text,
  payload text,
  meta_message_id text,
  meta_error_code integer,
  meta_error_subcode integer,
  error_message text,
  agent_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_message_events_idempotency_unique UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.ig_message_events IS
  'Instagram message log. Never stores access tokens or signed URLs.';

CREATE INDEX IF NOT EXISTS ix_ig_message_events_account_created
  ON public.ig_message_events (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_ig_message_events_contact_created
  ON public.ig_message_events (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_ig_message_events_run
  ON public.ig_message_events (run_id);
CREATE INDEX IF NOT EXISTS ix_ig_message_events_trigger
  ON public.ig_message_events (trigger_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.ig_automation_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_automation_assets_select ON public.ig_automation_assets;
CREATE POLICY ig_automation_assets_select ON public.ig_automation_assets
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS ig_automation_assets_insert ON public.ig_automation_assets;
CREATE POLICY ig_automation_assets_insert ON public.ig_automation_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_automation_assets_update ON public.ig_automation_assets;
CREATE POLICY ig_automation_assets_update ON public.ig_automation_assets
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_automation_assets_delete ON public.ig_automation_assets;
CREATE POLICY ig_automation_assets_delete ON public.ig_automation_assets
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_automation_steps_select ON public.ig_automation_steps;
CREATE POLICY ig_automation_steps_select ON public.ig_automation_steps
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS ig_automation_steps_insert ON public.ig_automation_steps;
CREATE POLICY ig_automation_steps_insert ON public.ig_automation_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_automation_steps_update ON public.ig_automation_steps;
CREATE POLICY ig_automation_steps_update ON public.ig_automation_steps
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_automation_steps_delete ON public.ig_automation_steps;
CREATE POLICY ig_automation_steps_delete ON public.ig_automation_steps
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_contacts_select ON public.ig_contacts;
CREATE POLICY ig_contacts_select ON public.ig_contacts
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS ig_automation_runs_select ON public.ig_automation_runs;
CREATE POLICY ig_automation_runs_select ON public.ig_automation_runs
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS ig_message_events_select ON public.ig_message_events;
CREATE POLICY ig_message_events_select ON public.ig_message_events
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_automation_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_automation_steps TO authenticated;
GRANT SELECT ON public.ig_contacts, public.ig_automation_runs, public.ig_message_events
  TO authenticated;
GRANT ALL ON
  public.ig_automation_assets,
  public.ig_automation_steps,
  public.ig_contacts,
  public.ig_automation_runs,
  public.ig_message_events
  TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS ig_automation_assets_set_updated_at ON public.ig_automation_assets;
CREATE TRIGGER ig_automation_assets_set_updated_at
  BEFORE UPDATE ON public.ig_automation_assets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS ig_automation_steps_set_updated_at ON public.ig_automation_steps;
CREATE TRIGGER ig_automation_steps_set_updated_at
  BEFORE UPDATE ON public.ig_automation_steps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS ig_contacts_set_updated_at ON public.ig_contacts;
CREATE TRIGGER ig_contacts_set_updated_at
  BEFORE UPDATE ON public.ig_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS ig_automation_runs_set_updated_at ON public.ig_automation_runs;
CREATE TRIGGER ig_automation_runs_set_updated_at
  BEFORE UPDATE ON public.ig_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS ig_message_events_set_updated_at ON public.ig_message_events;
CREATE TRIGGER ig_message_events_set_updated_at
  BEFORE UPDATE ON public.ig_message_events
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- Private storage bucket for automation assets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ig-automation-assets',
  'ig-automation-assets',
  false,
  26214400,
  ARRAY[
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav',
    'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg', 'audio/mpeg',
    'video/mp4', 'video/webm', 'video/quicktime',
    'image/png', 'image/jpeg',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS ig_automation_assets_storage_select ON storage.objects;
CREATE POLICY ig_automation_assets_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ig-automation-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_role_on_account(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS ig_automation_assets_storage_insert ON storage.objects;
CREATE POLICY ig_automation_assets_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ig-automation-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS ig_automation_assets_storage_update ON storage.objects;
CREATE POLICY ig_automation_assets_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ig-automation-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  )
  WITH CHECK (
    bucket_id = 'ig-automation-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS ig_automation_assets_storage_delete ON storage.objects;
CREATE POLICY ig_automation_assets_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ig-automation-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  );
