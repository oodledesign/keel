-- Desktop dictation snippets synced from KeelAssistant (global hotkey paste-at-cursor).

CREATE TABLE IF NOT EXISTS public.dictation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  text text NOT NULL,
  character_count integer NOT NULL DEFAULT 0,
  paste_mode boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'desktop_dictation'
    CHECK (source IN ('desktop_dictation')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_dictation_history_user_created
  ON public.dictation_history (user_id, created_at DESC);

ALTER TABLE public.dictation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dictation_history_select ON public.dictation_history;
CREATE POLICY dictation_history_select ON public.dictation_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.dictation_history TO authenticated;
GRANT ALL ON public.dictation_history TO service_role;
