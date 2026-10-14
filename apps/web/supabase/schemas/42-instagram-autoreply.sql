-- Instagram Auto-Reply: connected accounts, keyword triggers, comment event log.

CREATE TABLE IF NOT EXISTS public.ig_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  ig_business_account_id text NOT NULL,
  ig_username text,
  facebook_page_id text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  voice_settings jsonb NOT NULL DEFAULT '{
    "tone": "friendly",
    "emoji_usage": "light",
    "preferred_emojis": [],
    "banned_words": [],
    "custom_instructions": "",
    "language": "en-GB"
  }'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_connected_accounts_one_per_workspace UNIQUE (account_id),
  CONSTRAINT ig_connected_accounts_ig_business_unique UNIQUE (ig_business_account_id)
);

CREATE TABLE IF NOT EXISTS public.ig_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  keywords text[] NOT NULL,
  match_type text NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('contains', 'exact', 'regex')),
  scope text NOT NULL DEFAULT 'all_posts'
    CHECK (scope IN ('all_posts', 'specific_posts')),
  target_media_ids text[],

  public_reply_enabled boolean NOT NULL DEFAULT true,
  public_reply_mode text NOT NULL DEFAULT 'static'
    CHECK (public_reply_mode IN ('static', 'ai_generated')),
  public_reply_template text,
  public_reply_ai_tier text DEFAULT 'standard'
    CHECK (public_reply_ai_tier IN ('standard', 'enhanced')),

  dm_enabled boolean NOT NULL DEFAULT true,
  dm_mode text NOT NULL DEFAULT 'static'
    CHECK (dm_mode IN ('static', 'ai_generated')),
  dm_template text,
  dm_ai_tier text DEFAULT 'standard'
    CHECK (dm_ai_tier IN ('standard', 'enhanced')),

  dm_flow jsonb,

  voice_settings_override jsonb,

  create_deal_on_match boolean NOT NULL DEFAULT false,
  deal_stage text DEFAULT 'lead',

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ig_comment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  comment_id text NOT NULL,
  media_id text,
  commenter_username text,
  commenter_ig_id text,
  comment_text text,
  matched_trigger_id uuid REFERENCES public.ig_triggers (id) ON DELETE SET NULL,

  public_reply_status text DEFAULT 'pending'
    CHECK (public_reply_status IN ('pending', 'sent', 'skipped', 'failed')),
  public_reply_sent_at timestamptz,
  public_reply_content text,
  public_reply_ai_credits_spent numeric,

  dm_status text DEFAULT 'pending'
    CHECK (dm_status IN ('pending', 'sent', 'skipped', 'failed', 'window_expired')),
  dm_sent_at timestamptz,
  dm_content text,
  dm_ai_credits_spent numeric,

  pipeline_deal_id uuid REFERENCES public.pipeline_deals (id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_comment_events_comment_unique UNIQUE (ig_account_id, comment_id)
);

CREATE INDEX IF NOT EXISTS ix_ig_connected_accounts_account_id
  ON public.ig_connected_accounts (account_id);

CREATE INDEX IF NOT EXISTS ix_ig_triggers_ig_account_active
  ON public.ig_triggers (ig_account_id, is_active);

CREATE INDEX IF NOT EXISTS ix_ig_triggers_account_id
  ON public.ig_triggers (account_id);

CREATE INDEX IF NOT EXISTS ix_ig_comment_events_account_created
  ON public.ig_comment_events (account_id, created_at DESC);

ALTER TABLE public.ig_connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_comment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_connected_accounts_select ON public.ig_connected_accounts;
CREATE POLICY ig_connected_accounts_select ON public.ig_connected_accounts
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS ig_connected_accounts_insert ON public.ig_connected_accounts;
CREATE POLICY ig_connected_accounts_insert ON public.ig_connected_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_connected_accounts_update ON public.ig_connected_accounts;
CREATE POLICY ig_connected_accounts_update ON public.ig_connected_accounts
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_connected_accounts_delete ON public.ig_connected_accounts;
CREATE POLICY ig_connected_accounts_delete ON public.ig_connected_accounts
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_triggers_select ON public.ig_triggers;
CREATE POLICY ig_triggers_select ON public.ig_triggers
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS ig_triggers_insert ON public.ig_triggers;
CREATE POLICY ig_triggers_insert ON public.ig_triggers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_triggers_update ON public.ig_triggers;
CREATE POLICY ig_triggers_update ON public.ig_triggers
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_triggers_delete ON public.ig_triggers;
CREATE POLICY ig_triggers_delete ON public.ig_triggers
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'settings.manage'::public.app_permissions)
  );

DROP POLICY IF EXISTS ig_comment_events_select ON public.ig_comment_events;
CREATE POLICY ig_comment_events_select ON public.ig_comment_events
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP TRIGGER IF EXISTS ig_connected_accounts_set_updated_at ON public.ig_connected_accounts;
CREATE TRIGGER ig_connected_accounts_set_updated_at
  BEFORE UPDATE ON public.ig_connected_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS ig_triggers_set_updated_at ON public.ig_triggers;
CREATE TRIGGER ig_triggers_set_updated_at
  BEFORE UPDATE ON public.ig_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_connected_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_triggers TO authenticated;
GRANT SELECT ON public.ig_comment_events TO authenticated;
GRANT ALL ON public.ig_connected_accounts, public.ig_triggers, public.ig_comment_events
  TO postgres, service_role;

COMMENT ON TABLE public.ig_connected_accounts IS
  'Instagram Business account connected for comment auto-reply (one per workspace in v1).';
COMMENT ON TABLE public.ig_triggers IS
  'Keyword-triggered automations for Instagram comment replies and DMs.';
COMMENT ON TABLE public.ig_comment_events IS
  'Audit log of processed Instagram comment webhook events.';
COMMENT ON COLUMN public.ig_connected_accounts.access_token IS
  'Encrypted at rest (see lib/instagram-autoreply/token-crypto).';

-- ===========================================================================
-- Interactive DM sessions (legacy, superseded by ig_automation_runs)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.ig_dm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.ig_triggers (id) ON DELETE CASCADE,
  comment_event_id uuid REFERENCES public.ig_comment_events (id) ON DELETE SET NULL,
  commenter_ig_id text NOT NULL,
  current_step_id text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ig_dm_sessions_active_lookup
  ON public.ig_dm_sessions (ig_account_id, commenter_ig_id, status)
  WHERE status = 'active';

ALTER TABLE public.ig_dm_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_dm_sessions_select ON public.ig_dm_sessions;
CREATE POLICY ig_dm_sessions_select ON public.ig_dm_sessions
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

GRANT SELECT ON public.ig_dm_sessions TO authenticated;
GRANT ALL ON public.ig_dm_sessions TO postgres, service_role;

DROP TRIGGER IF EXISTS ig_dm_sessions_set_updated_at ON public.ig_dm_sessions;
CREATE TRIGGER ig_dm_sessions_set_updated_at
  BEFORE UPDATE ON public.ig_dm_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

-- ===========================================================================
-- Instagram Automation v2
-- ===========================================================================

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

-- ---------------------------------------------------------------------------
-- Sequence worker (migrations 20270217120200, 20270217120300, 20270217120400)
-- ---------------------------------------------------------------------------

ALTER TABLE public.ig_automation_runs
  ADD COLUMN IF NOT EXISTS steps_executed integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ig_automation_runs.steps_executed IS
  'Monotonic step counter. Outbound idempotency keys are run:{id}:exec:{n}, so a step is never sent twice even when a branch revisits it.';

ALTER TABLE public.ig_automation_runs
  ADD COLUMN IF NOT EXISTS follow_gate_passed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_ig_automation_runs(
  p_limit integer DEFAULT 25,
  p_lock_seconds integer DEFAULT 120
)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.ig_automation_runs AS r
  SET locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE r.id IN (
    SELECT c.id
    FROM public.ig_automation_runs AS c
    WHERE (
        (c.status IN ('active', 'waiting_delay')
          AND c.next_step_at IS NOT NULL
          AND c.next_step_at <= now())
        OR (c.status = 'active'
          AND c.next_step_at IS NULL
          AND c.updated_at < now() - interval '2 minutes')
      )
      AND (c.locked_until IS NULL OR c.locked_until < now())
    ORDER BY coalesce(c.next_step_at, c.updated_at)
    LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id;
$$;

REVOKE ALL ON FUNCTION public.claim_ig_automation_runs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_ig_automation_runs(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_automation_runs(integer, integer) TO service_role;

CREATE INDEX IF NOT EXISTS ig_automation_runs_due_idx
  ON public.ig_automation_runs (status, next_step_at)
  WHERE status IN ('active', 'waiting_delay');

-- Single-run lock used by webhook-triggered advances.
CREATE OR REPLACE FUNCTION public.lock_ig_automation_run(
  p_run_id uuid,
  p_lock_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH locked AS (
    UPDATE public.ig_automation_runs
    SET locked_until = now() + make_interval(secs => p_lock_seconds)
    WHERE id = p_run_id
      AND (locked_until IS NULL OR locked_until < now())
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM locked);
$$;

REVOKE ALL ON FUNCTION public.lock_ig_automation_run(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_ig_automation_run(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_ig_automation_run(uuid, integer) TO service_role;

-- Ice Breakers / persistent menu as last pushed to Meta (migration 20270217120500)
ALTER TABLE public.ig_connected_accounts
  ADD COLUMN IF NOT EXISTS messenger_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Atomic step replacement for the builder (migration 20270217120600)
CREATE OR REPLACE FUNCTION public.replace_ig_automation_steps(
  p_trigger_id uuid,
  p_steps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF jsonb_typeof(p_steps) <> 'array' THEN
    RAISE EXCEPTION 'p_steps must be a JSON array';
  END IF;

  SELECT t.account_id INTO v_account_id
  FROM public.ig_triggers AS t
  WHERE t.id = p_trigger_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Automation not found';
  END IF;

  -- RLS alone would allow assets from another account the user belongs to.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_steps) AS s(value)
    WHERE nullif(s.value ->> 'asset_id', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.ig_automation_assets AS a
        WHERE a.id = (s.value ->> 'asset_id')::uuid
          AND a.account_id = v_account_id
      )
  ) THEN
    RAISE EXCEPTION 'Asset not found for this account';
  END IF;

  DELETE FROM public.ig_automation_steps WHERE trigger_id = p_trigger_id;

  INSERT INTO public.ig_automation_steps
    (account_id, trigger_id, position, step_type, config, asset_id)
  SELECT
    v_account_id,
    p_trigger_id,
    (s.ord - 1)::integer,
    s.value ->> 'step_type',
    coalesce(s.value -> 'config', '{}'::jsonb),
    nullif(s.value ->> 'asset_id', '')::uuid
  FROM jsonb_array_elements(p_steps) WITH ORDINALITY AS s(value, ord);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_ig_automation_steps(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_ig_automation_steps(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_ig_automation_steps(uuid, jsonb) TO authenticated, service_role;

-- Instagram Automation v2: per-contact erasure (UK GDPR) that keeps funnel
-- counts. Erasing a contact rolls their run/event counts into
-- ig_automation_stats_erased (no personal data), scrubs their legacy comment
-- log rows, then deletes the contact (runs and events cascade).

CREATE TABLE IF NOT EXISTS public.ig_automation_stats_erased (
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.ig_triggers (id) ON DELETE CASCADE,
  day date NOT NULL,
  metric text NOT NULL CHECK (
    metric IN ('triggered', 'completed', 'sent', 'tapped', 'collected')
  ),
  step_position integer NOT NULL DEFAULT -1,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (trigger_id, day, metric, step_position)
);

COMMENT ON TABLE public.ig_automation_stats_erased IS
  'Funnel counts retained after an Instagram contact is erased. Holds no personal data. step_position -1 = not step-specific.';

CREATE INDEX IF NOT EXISTS ix_ig_automation_stats_erased_account
  ON public.ig_automation_stats_erased (account_id, day);

ALTER TABLE public.ig_automation_stats_erased ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_automation_stats_erased_select ON public.ig_automation_stats_erased;
CREATE POLICY ig_automation_stats_erased_select ON public.ig_automation_stats_erased
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

REVOKE ALL ON public.ig_automation_stats_erased FROM anon, authenticated;
GRANT SELECT ON public.ig_automation_stats_erased TO authenticated;
GRANT ALL ON public.ig_automation_stats_erased TO service_role;

CREATE OR REPLACE FUNCTION public.erase_ig_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contact public.ig_contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_contact FROM public.ig_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_permission(
    auth.uid(),
    v_contact.account_id,
    'settings.manage'::public.app_permissions
  ) THEN
    RAISE EXCEPTION 'You do not have permission to erase this contact';
  END IF;

  INSERT INTO public.ig_automation_stats_erased AS s (
    account_id, trigger_id, day, metric, step_position, count
  )
  SELECT account_id, trigger_id, day, metric, step_position, count(*)::integer
  FROM (
    SELECT r.account_id, r.trigger_id,
      (r.created_at AT TIME ZONE 'UTC')::date AS day,
      'triggered'::text AS metric, -1 AS step_position
    FROM public.ig_automation_runs r
    WHERE r.contact_id = p_contact_id AND r.source <> 'test'

    UNION ALL
    SELECT r.account_id, r.trigger_id,
      (r.created_at AT TIME ZONE 'UTC')::date, 'completed', -1
    FROM public.ig_automation_runs r
    WHERE r.contact_id = p_contact_id
      AND r.source <> 'test'
      AND r.status = 'completed'

    UNION ALL
    SELECT e.account_id, e.trigger_id,
      (e.created_at AT TIME ZONE 'UTC')::date,
      CASE
        WHEN e.direction = 'outbound' THEN 'sent'
        WHEN e.step_type = 'collect_data' THEN 'collected'
        ELSE 'tapped'
      END,
      coalesce(e.step_position, -1)
    FROM public.ig_message_events e
    WHERE e.contact_id = p_contact_id
      AND e.trigger_id IS NOT NULL
      AND (
        (
          e.direction = 'outbound'
          AND e.event_type IN ('step', 'private_reply')
          AND e.send_status = 'sent'
        )
        OR (
          e.direction = 'inbound'
          AND e.step_type IN ('quick_replies', 'buttons', 'collect_data')
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ig_automation_runs r
        WHERE r.id = e.run_id AND r.source = 'test'
      )
  ) rows
  GROUP BY account_id, trigger_id, day, metric, step_position
  ON CONFLICT (trigger_id, day, metric, step_position)
  DO UPDATE SET count = s.count + EXCLUDED.count;

  UPDATE public.ig_comment_events
  SET commenter_username = NULL,
      commenter_ig_id = NULL,
      comment_text = NULL,
      public_reply_content = NULL,
      dm_content = NULL
  WHERE ig_account_id = v_contact.ig_account_id
    AND commenter_ig_id = v_contact.igsid;

  DELETE FROM public.ig_contacts WHERE id = p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.erase_ig_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erase_ig_contact(uuid) TO authenticated;

-- Instagram Automation v2: plan-level caps for automations and sends.
-- Follows the account_plan_limits convention: NULL = unlimited / not enforced.

ALTER TABLE public.account_plan_limits
  ADD COLUMN IF NOT EXISTS max_ig_automations integer,
  ADD COLUMN IF NOT EXISTS max_ig_sends_per_month integer,
  ADD COLUMN IF NOT EXISTS ig_hourly_send_cap integer;

COMMENT ON COLUMN public.account_plan_limits.max_ig_automations IS
  'Max Instagram automations (ig_triggers) per account. NULL = unlimited.';
COMMENT ON COLUMN public.account_plan_limits.max_ig_sends_per_month IS
  'Max automated Instagram messages sent per calendar month (UTC). NULL = unlimited.';
COMMENT ON COLUMN public.account_plan_limits.ig_hourly_send_cap IS
  'Per-account hourly Instagram send cap. NULL = use the IG_HOURLY_SEND_CAP env default.';

-- Instagram Automation v2: funnel analytics per automation. Counts runs
-- triggered/completed, steps sent, taps and collected answers since a date,
-- excluding "Send to me" test runs, plus counts retained from erased contacts.
-- SECURITY INVOKER so RLS limits results to the caller's accounts.

CREATE OR REPLACE FUNCTION public.ig_automation_funnel(
  p_account_id uuid,
  p_since timestamptz
)
RETURNS TABLE (
  trigger_id uuid,
  metric text,
  step_position integer,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH test_runs AS (
    SELECT r.id
    FROM public.ig_automation_runs r
    WHERE r.account_id = p_account_id AND r.source = 'test'
  ),
  live AS (
    SELECT r.trigger_id, 'triggered'::text AS metric, -1 AS step_position
    FROM public.ig_automation_runs r
    WHERE r.account_id = p_account_id
      AND r.source <> 'test'
      AND r.created_at >= p_since

    UNION ALL
    SELECT r.trigger_id, 'completed', -1
    FROM public.ig_automation_runs r
    WHERE r.account_id = p_account_id
      AND r.source <> 'test'
      AND r.status = 'completed'
      AND r.created_at >= p_since

    UNION ALL
    SELECT e.trigger_id,
      CASE
        WHEN e.direction = 'outbound' THEN 'sent'
        WHEN e.step_type = 'collect_data' THEN 'collected'
        ELSE 'tapped'
      END,
      coalesce(e.step_position, -1)
    FROM public.ig_message_events e
    WHERE e.account_id = p_account_id
      AND e.created_at >= p_since
      AND e.trigger_id IS NOT NULL
      AND (
        (
          e.direction = 'outbound'
          AND e.event_type IN ('step', 'private_reply')
          AND e.send_status = 'sent'
        )
        OR (
          e.direction = 'inbound'
          AND e.step_type IN ('quick_replies', 'buttons', 'collect_data')
        )
      )
      AND (e.run_id IS NULL OR e.run_id NOT IN (SELECT id FROM test_runs))
  )
  SELECT l.trigger_id, l.metric, l.step_position, count(*)::bigint
  FROM live l
  GROUP BY l.trigger_id, l.metric, l.step_position

  UNION ALL
  SELECT s.trigger_id, s.metric, s.step_position, sum(s.count)::bigint
  FROM public.ig_automation_stats_erased s
  WHERE s.account_id = p_account_id
    AND s.day >= (p_since AT TIME ZONE 'UTC')::date
  GROUP BY s.trigger_id, s.metric, s.step_position;
$$;

REVOKE ALL ON FUNCTION public.ig_automation_funnel(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ig_automation_funnel(uuid, timestamptz)
  TO authenticated, service_role;

-- Instagram Automation v2: record media credits charged for TTS voice notes.

ALTER TABLE public.ig_automation_assets
  ADD COLUMN IF NOT EXISTS media_credits_charged integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ig_automation_assets.media_credits_charged IS
  'Media credits debited for this asset (TTS only), charged once the audio is ready.';
