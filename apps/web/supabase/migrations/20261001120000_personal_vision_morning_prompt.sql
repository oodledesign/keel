-- Optional morning Personal Vision reminder (popup once per local day).
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS personal_vision_morning_prompt_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_settings.personal_vision_morning_prompt_enabled IS
  'When true, show a once-per-morning prompt to open Personal Vision if the deck has content.';
