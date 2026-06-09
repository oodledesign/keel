-- Video Hosting module: folders, videos, player configs (Bunny Stream)

CREATE TABLE IF NOT EXISTS public.video_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.video_folders (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_video_folders_account_id
  ON public.video_folders (account_id);

CREATE INDEX IF NOT EXISTS ix_video_folders_parent_folder_id
  ON public.video_folders (parent_folder_id);

COMMENT ON TABLE public.video_folders IS 'Account-scoped folders for hosted videos.';

CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.video_folders (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  bunny_video_id text NOT NULL,
  bunny_library_id text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'processing',
  original_filename text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT videos_bunny_video_id_unique UNIQUE (bunny_video_id),
  CONSTRAINT videos_status_check CHECK (
    status IN ('uploading', 'processing', 'ready', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS ix_videos_account_id
  ON public.videos (account_id);

CREATE INDEX IF NOT EXISTS ix_videos_folder_id
  ON public.videos (folder_id);

CREATE INDEX IF NOT EXISTS ix_videos_account_status
  ON public.videos (account_id, status);

COMMENT ON TABLE public.videos IS 'Hosted videos synced with Bunny Stream.';

CREATE TABLE IF NOT EXISTS public.video_player_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.videos (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  is_preset boolean NOT NULL DEFAULT false,
  autoplay boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  loop boolean NOT NULL DEFAULT false,
  preload text NOT NULL DEFAULT 'metadata',
  default_playback_speed numeric NOT NULL DEFAULT 1.0,
  allowed_speeds numeric[] NOT NULL DEFAULT '{0.5,0.75,1,1.25,1.5,2}',
  show_controls boolean NOT NULL DEFAULT true,
  show_play_button boolean NOT NULL DEFAULT true,
  show_progress_bar boolean NOT NULL DEFAULT true,
  show_volume_control boolean NOT NULL DEFAULT true,
  show_speed_control boolean NOT NULL DEFAULT true,
  show_fullscreen_button boolean NOT NULL DEFAULT true,
  show_captions_button boolean NOT NULL DEFAULT true,
  primary_color text NOT NULL DEFAULT '#6366F1',
  show_bunny_watermark boolean NOT NULL DEFAULT false,
  custom_logo_url text,
  logo_position text NOT NULL DEFAULT 'top-right',
  enable_captions boolean NOT NULL DEFAULT false,
  default_caption_language text NOT NULL DEFAULT 'en',
  responsive boolean NOT NULL DEFAULT true,
  aspect_ratio text NOT NULL DEFAULT '16:9',
  max_width_px integer,
  allow_download boolean NOT NULL DEFAULT false,
  token_auth_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_player_configs_preload_check CHECK (
    preload IN ('none', 'metadata', 'auto')
  ),
  CONSTRAINT video_player_configs_logo_position_check CHECK (
    logo_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')
  ),
  CONSTRAINT video_player_configs_primary_color_hex CHECK (
    primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT video_player_configs_preset_video_check CHECK (
    (is_preset = true AND video_id IS NULL)
    OR (is_preset = false)
  )
);

CREATE INDEX IF NOT EXISTS ix_video_player_configs_account_id
  ON public.video_player_configs (account_id);

CREATE INDEX IF NOT EXISTS ix_video_player_configs_video_id
  ON public.video_player_configs (video_id);

COMMENT ON TABLE public.video_player_configs IS 'Per-video or preset Bunny player embed settings.';

DROP TRIGGER IF EXISTS videos_set_timestamps ON public.videos;
CREATE TRIGGER videos_set_timestamps
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS video_player_configs_set_timestamps ON public.video_player_configs;
CREATE TRIGGER video_player_configs_set_timestamps
  BEFORE UPDATE ON public.video_player_configs
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.video_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_player_configs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_folders TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_player_configs TO authenticated, service_role;

-- video_folders
DROP POLICY IF EXISTS video_folders_select ON public.video_folders;
CREATE POLICY video_folders_select ON public.video_folders
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS video_folders_insert ON public.video_folders;
CREATE POLICY video_folders_insert ON public.video_folders
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS video_folders_update ON public.video_folders;
CREATE POLICY video_folders_update ON public.video_folders
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account (account_id))
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS video_folders_delete ON public.video_folders;
CREATE POLICY video_folders_delete ON public.video_folders
  FOR DELETE TO authenticated
  USING (public.has_role_on_account (account_id));

-- videos
DROP POLICY IF EXISTS videos_select ON public.videos;
CREATE POLICY videos_select ON public.videos
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS videos_insert ON public.videos;
CREATE POLICY videos_insert ON public.videos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS videos_update ON public.videos;
CREATE POLICY videos_update ON public.videos
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account (account_id))
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS videos_delete ON public.videos;
CREATE POLICY videos_delete ON public.videos
  FOR DELETE TO authenticated
  USING (public.has_role_on_account (account_id));

-- video_player_configs
DROP POLICY IF EXISTS video_player_configs_select ON public.video_player_configs;
CREATE POLICY video_player_configs_select ON public.video_player_configs
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS video_player_configs_insert ON public.video_player_configs;
CREATE POLICY video_player_configs_insert ON public.video_player_configs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS video_player_configs_update ON public.video_player_configs;
CREATE POLICY video_player_configs_update ON public.video_player_configs
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account (account_id))
  WITH CHECK (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS video_player_configs_delete ON public.video_player_configs;
CREATE POLICY video_player_configs_delete ON public.video_player_configs
  FOR DELETE TO authenticated
  USING (public.has_role_on_account (account_id));

NOTIFY pgrst, 'reload schema';
