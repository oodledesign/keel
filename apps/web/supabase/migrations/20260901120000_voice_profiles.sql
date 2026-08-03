-- Tone of voice profiles: curated guidance + themes + sample sources (no embedding pipeline).

CREATE TABLE IF NOT EXISTS public.voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('personal', 'brand')),
  owner_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'updating')),
  guidance_text text,
  learn_from_sent_email boolean NOT NULL DEFAULT false,
  distill_count_day date,
  distill_count integer NOT NULL DEFAULT 0,
  last_distilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_profiles_owner_xor CHECK (
    (kind = 'personal' AND owner_user_id IS NOT NULL AND account_id IS NULL)
    OR (kind = 'brand' AND account_id IS NOT NULL AND owner_user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_voice_profiles_personal_user
  ON public.voice_profiles (owner_user_id)
  WHERE kind = 'personal';

CREATE UNIQUE INDEX IF NOT EXISTS ux_voice_profiles_brand_account
  ON public.voice_profiles (account_id)
  WHERE kind = 'brand';

CREATE TABLE IF NOT EXISTS public.voice_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.voice_profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  examples text[] NOT NULL DEFAULT '{}',
  weight integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('distilled', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_voice_themes_profile
  ON public.voice_themes (profile_id, weight DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS public.voice_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.voice_profiles (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('paste', 'upload', 'sent_email')),
  title text NOT NULL DEFAULT 'Sample',
  content_text text NOT NULL DEFAULT '',
  storage_path text,
  included boolean NOT NULL DEFAULT true,
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_voice_sources_profile
  ON public.voice_sources (profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_voice_sources_external_ref
  ON public.voice_sources (profile_id, external_ref)
  WHERE external_ref IS NOT NULL;

COMMENT ON TABLE public.voice_profiles IS
  'Personal or workspace brand voice profile distilled for AI drafting.';
COMMENT ON TABLE public.voice_themes IS
  'Editable tone themes shown in settings and summarized into prompts.';
COMMENT ON TABLE public.voice_sources IS
  'Writing samples that feed distillation; not dumped into every prompt.';

CREATE OR REPLACE FUNCTION public.set_voice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_profiles_updated_at ON public.voice_profiles;
CREATE TRIGGER trg_voice_profiles_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_voice_updated_at();

DROP TRIGGER IF EXISTS trg_voice_themes_updated_at ON public.voice_themes;
CREATE TRIGGER trg_voice_themes_updated_at
  BEFORE UPDATE ON public.voice_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_voice_updated_at();

DROP TRIGGER IF EXISTS trg_voice_sources_updated_at ON public.voice_sources;
CREATE TRIGGER trg_voice_sources_updated_at
  BEFORE UPDATE ON public.voice_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_voice_updated_at();

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sources ENABLE ROW LEVEL SECURITY;

-- Personal profiles: owner only
CREATE POLICY voice_profiles_personal_all ON public.voice_profiles
  FOR ALL TO authenticated
  USING (
    kind = 'personal' AND owner_user_id = auth.uid()
  )
  WITH CHECK (
    kind = 'personal' AND owner_user_id = auth.uid()
  );

-- Brand profiles: members can read; settings.manage can write
CREATE POLICY voice_profiles_brand_select ON public.voice_profiles
  FOR SELECT TO authenticated
  USING (
    kind = 'brand'
    AND account_id IS NOT NULL
    AND public.has_role_on_account(account_id)
  );

CREATE POLICY voice_profiles_brand_insert ON public.voice_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'brand'
    AND account_id IS NOT NULL
    AND public.has_permission(
      auth.uid(),
      account_id,
      'settings.manage'::public.app_permissions
    )
  );

CREATE POLICY voice_profiles_brand_update ON public.voice_profiles
  FOR UPDATE TO authenticated
  USING (
    kind = 'brand'
    AND account_id IS NOT NULL
    AND public.has_permission(
      auth.uid(),
      account_id,
      'settings.manage'::public.app_permissions
    )
  )
  WITH CHECK (
    kind = 'brand'
    AND account_id IS NOT NULL
    AND public.has_permission(
      auth.uid(),
      account_id,
      'settings.manage'::public.app_permissions
    )
  );

CREATE POLICY voice_profiles_brand_delete ON public.voice_profiles
  FOR DELETE TO authenticated
  USING (
    kind = 'brand'
    AND account_id IS NOT NULL
    AND public.has_permission(
      auth.uid(),
      account_id,
      'settings.manage'::public.app_permissions
    )
  );

-- Themes / sources follow parent profile access
CREATE POLICY voice_themes_select ON public.voice_themes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_profiles p
      WHERE p.id = profile_id
        AND (
          (p.kind = 'personal' AND p.owner_user_id = auth.uid())
          OR (
            p.kind = 'brand'
            AND p.account_id IS NOT NULL
            AND public.has_role_on_account(p.account_id)
          )
        )
    )
  );

CREATE POLICY voice_themes_write ON public.voice_themes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_profiles p
      WHERE p.id = profile_id
        AND (
          (p.kind = 'personal' AND p.owner_user_id = auth.uid())
          OR (
            p.kind = 'brand'
            AND p.account_id IS NOT NULL
            AND public.has_permission(
              auth.uid(),
              p.account_id,
              'settings.manage'::public.app_permissions
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.voice_profiles p
      WHERE p.id = profile_id
        AND (
          (p.kind = 'personal' AND p.owner_user_id = auth.uid())
          OR (
            p.kind = 'brand'
            AND p.account_id IS NOT NULL
            AND public.has_permission(
              auth.uid(),
              p.account_id,
              'settings.manage'::public.app_permissions
            )
          )
        )
    )
  );

CREATE POLICY voice_sources_select ON public.voice_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_profiles p
      WHERE p.id = profile_id
        AND (
          (p.kind = 'personal' AND p.owner_user_id = auth.uid())
          OR (
            p.kind = 'brand'
            AND p.account_id IS NOT NULL
            AND public.has_role_on_account(p.account_id)
          )
        )
    )
  );

CREATE POLICY voice_sources_write ON public.voice_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.voice_profiles p
      WHERE p.id = profile_id
        AND (
          (p.kind = 'personal' AND p.owner_user_id = auth.uid())
          OR (
            p.kind = 'brand'
            AND p.account_id IS NOT NULL
            AND public.has_permission(
              auth.uid(),
              p.account_id,
              'settings.manage'::public.app_permissions
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.voice_profiles p
      WHERE p.id = profile_id
        AND (
          (p.kind = 'personal' AND p.owner_user_id = auth.uid())
          OR (
            p.kind = 'brand'
            AND p.account_id IS NOT NULL
            AND public.has_permission(
              auth.uid(),
              p.account_id,
              'settings.manage'::public.app_permissions
            )
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_sources TO authenticated;
