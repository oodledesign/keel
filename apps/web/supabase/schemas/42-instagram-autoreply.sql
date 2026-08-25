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
